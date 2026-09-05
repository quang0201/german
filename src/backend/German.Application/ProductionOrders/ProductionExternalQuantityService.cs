using System.Linq.Expressions;
using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionOrders;

public sealed class ProductionExternalQuantityService(IGermanDbContext db)
{
    public async Task<AppResult<IReadOnlyList<ProductionExternalQuantityDto>>> ListAsync(
        Guid orderId,
        Guid? operationId,
        DateOnly? fromDate,
        DateOnly? untilDate,
        CancellationToken cancellationToken)
    {
        if (fromDate.HasValue && untilDate.HasValue && fromDate > untilDate)
        {
            return AppResult<IReadOnlyList<ProductionExternalQuantityDto>>.Failure(
                "production_external_quantity.invalid_date_range",
                "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
        }

        var query = db.ProductionExternalQuantities.AsNoTracking()
            .Where(item => item.ProductionOrderId == orderId);
        if (operationId.HasValue)
        {
            query = query.Where(item => item.ProductionOperationId == operationId.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(item => item.ReceivedDate >= fromDate.Value);
        }

        if (untilDate.HasValue)
        {
            query = query.Where(item => item.ReceivedDate <= untilDate.Value);
        }

        var items = await query
            .OrderByDescending(item => item.ReceivedDate)
            .ThenBy(item => item.CreatedAt)
            .Select(ToProjection())
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<ProductionExternalQuantityDto>>.Success(items);
    }

    public async Task<AppResult<IReadOnlyList<ProductionExternalQuantitySummaryDto>>> SummarizeAsync(
        Guid orderId,
        Guid? operationId,
        DateOnly? fromDate,
        DateOnly? untilDate,
        CancellationToken cancellationToken)
    {
        if (fromDate.HasValue && untilDate.HasValue && fromDate > untilDate)
        {
            return AppResult<IReadOnlyList<ProductionExternalQuantitySummaryDto>>.Failure(
                "production_external_quantity.invalid_date_range",
                "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
        }

        var query =
            from external in db.ProductionExternalQuantities.AsNoTracking()
            join operation in db.ProductionOperations.AsNoTracking()
                on external.ProductionOperationId equals operation.Id
            join employee in db.Employees.AsNoTracking()
                on external.SourceEmployeeId equals employee.Id into sourceEmployees
            from employee in sourceEmployees.DefaultIfEmpty()
            where external.ProductionOrderId == orderId
                && (!operationId.HasValue || external.ProductionOperationId == operationId.Value)
                && (!fromDate.HasValue || external.ReceivedDate >= fromDate.Value)
                && (!untilDate.HasValue || external.ReceivedDate <= untilDate.Value)
            select new
            {
                external.SourceName,
                external.SourceEmployeeId,
                SourceEmployeeName = employee == null ? null : employee.FullName,
                external.Quantity,
                external.ProductionOperationId,
                operation.OperationNumber,
                OperationName = operation.Name,
                operation.Unit
            };

        var items = await query
            .OrderBy(item => item.SourceName)
            .ThenBy(item => item.OperationNumber)
            .ToListAsync(cancellationToken);

        var summaries = items
            .GroupBy(item => item.SourceEmployeeId.HasValue
                ? $"employee:{item.SourceEmployeeId.Value}"
                : $"source:{NormalizeSource(item.SourceName)}", StringComparer.OrdinalIgnoreCase)
            .OrderBy(group => group.First().SourceEmployeeName ?? NormalizeSource(group.First().SourceName), StringComparer.OrdinalIgnoreCase)
            .Select(group => new ProductionExternalQuantitySummaryDto(
                group.First().SourceEmployeeName ?? NormalizeSource(group.First().SourceName),
                group.Sum(item => item.Quantity),
                group
                    .GroupBy(item => new
                    {
                        item.ProductionOperationId,
                        item.OperationNumber,
                        item.OperationName,
                        item.Unit
                    })
                    .OrderBy(operation => operation.Key.OperationNumber)
                    .Select(operation => new ProductionExternalQuantityOperationSummaryDto(
                        operation.Key.ProductionOperationId,
                        operation.Key.OperationNumber,
                        operation.Key.OperationName,
                        operation.Key.Unit,
                        operation.Sum(item => item.Quantity)))
                    .ToArray(),
                group
                    .GroupBy(item => item.Unit, StringComparer.OrdinalIgnoreCase)
                    .OrderBy(unit => unit.Key, StringComparer.OrdinalIgnoreCase)
                    .Select(unit => new ProductionExternalQuantityUnitSummaryDto(unit.Key, unit.Sum(item => item.Quantity)))
                    .ToArray()))
            .ToArray();

        return AppResult<IReadOnlyList<ProductionExternalQuantitySummaryDto>>.Success(summaries);
    }

    public async Task<AppResult<ProductionExternalQuantityDto>> CreateAsync(CurrentActor actor, CreateProductionExternalQuantityCommand command, CancellationToken cancellationToken)
    {
        var authorization = EnsureManagerOrAdmin(actor);
        if (!authorization.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(authorization.Error!.Code, authorization.Error.Message);
        var validation = ValidateQuantity(command.Quantity);
        if (!validation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(validation.Error!.Code, validation.Error.Message);
        var textValidation = ValidateText(command.SourceName, "source_name", 200);
        if (!textValidation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(textValidation.Error!.Code, textValidation.Error.Message);
        textValidation = ValidateText(command.Note, "note", 1000);
        if (!textValidation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(textValidation.Error!.Code, textValidation.Error.Message);
        var referenceValidation = await ValidateReferencesAsync(command.ProductionOrderId, command.ProductionOperationId, cancellationToken);
        if (!referenceValidation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(referenceValidation.Error!.Code, referenceValidation.Error.Message);

        var now = DateTimeOffset.UtcNow;
        var item = new ProductionExternalQuantity
        {
            ProductionOrderId = command.ProductionOrderId,
            ProductionOperationId = command.ProductionOperationId,
            SourceEmployeeId = await ResolveSourceEmployeeIdAsync(command.SourceName, cancellationToken),
            ReceivedDate = command.ReceivedDate,
            Quantity = command.Quantity,
            SourceName = Normalize(command.SourceName),
            Note = Normalize(command.Note),
            SubmittedByUserId = actor.UserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ProductionExternalQuantities.Add(item);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionExternalQuantityDto>.Success(ToDto(item));
    }

    public async Task<AppResult<ProductionExternalQuantityDto>> UpdateAsync(CurrentActor actor, Guid id, UpdateProductionExternalQuantityCommand command, CancellationToken cancellationToken)
    {
        var authorization = EnsureManagerOrAdmin(actor);
        if (!authorization.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(authorization.Error!.Code, authorization.Error.Message);
        var item = await db.ProductionExternalQuantities.FirstOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (item is null) return AppResult<ProductionExternalQuantityDto>.Failure("production_external_quantity.not_found", "Không tìm thấy sản lượng nhận ngoài.");
        var validation = ValidateQuantity(command.Quantity);
        if (!validation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(validation.Error!.Code, validation.Error.Message);
        var textValidation = ValidateText(command.SourceName, "source_name", 200);
        if (!textValidation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(textValidation.Error!.Code, textValidation.Error.Message);
        textValidation = ValidateText(command.Note, "note", 1000);
        if (!textValidation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(textValidation.Error!.Code, textValidation.Error.Message);

        item.ReceivedDate = command.ReceivedDate;
        item.Quantity = command.Quantity;
        item.SourceName = Normalize(command.SourceName);
        item.SourceEmployeeId = await ResolveSourceEmployeeIdAsync(command.SourceName, cancellationToken);
        item.Note = Normalize(command.Note);
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionExternalQuantityDto>.Success(ToDto(item));
    }

    public async Task<AppResult> DeleteAsync(CurrentActor actor, Guid id, CancellationToken cancellationToken)
    {
        var authorization = EnsureManagerOrAdmin(actor);
        if (!authorization.IsSuccess) return authorization;
        var item = await db.ProductionExternalQuantities.FirstOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (item is null) return AppResult.Failure("production_external_quantity.not_found", "Không tìm thấy sản lượng nhận ngoài.");
        db.ProductionExternalQuantities.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult.Success();
    }

    private async Task<AppResult> ValidateReferencesAsync(Guid orderId, Guid operationId, CancellationToken cancellationToken)
    {
        if (!await db.ProductionOrders.AsNoTracking().AnyAsync(item => item.Id == orderId, cancellationToken))
            return AppResult.Failure("production_external_quantity.order_not_found", "Không tìm thấy mã sản xuất.");
        if (!await db.ProductionOperations.AsNoTracking().AnyAsync(item => item.Id == operationId, cancellationToken))
            return AppResult.Failure("production_external_quantity.operation_not_found", "Không tìm thấy công đoạn.");
        if (!await db.ProductionOperations.AsNoTracking().AnyAsync(item => item.Id == operationId && item.ProductionOrderId == orderId, cancellationToken))
            return AppResult.Failure("production_external_quantity.operation_mismatch", "Công đoạn không thuộc mã sản xuất đã chọn.");
        return AppResult.Success();
    }

    private static AppResult EnsureManagerOrAdmin(CurrentActor actor) => actor.Role is UserRole.Manager or UserRole.Admin
        ? AppResult.Success()
        : AppResult.Failure("production_external_quantity.forbidden", "Bạn không có quyền quản lý sản lượng nhận ngoài.");

    private static AppResult ValidateQuantity(decimal quantity) => quantity > 0m
        ? AppResult.Success()
        : AppResult.Failure("production_external_quantity.invalid_quantity", "Số lượng phải lớn hơn 0.");

    private static AppResult ValidateText(string? value, string field, int maxLength) =>
        value is not null && value.Trim().Length > maxLength
            ? AppResult.Failure($"production_external_quantity.invalid_{field}", $"{field} không được dài quá {maxLength} ký tự.")
            : AppResult.Success();

    private static string? Normalize(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string NormalizeSource(string? value)
    {
        var normalized = Normalize(value);
        return string.IsNullOrWhiteSpace(normalized) ? "Không ghi nguồn" : normalized;
    }

    private async Task<Guid?> ResolveSourceEmployeeIdAsync(string? sourceName, CancellationToken cancellationToken)
    {
        var normalized = Normalize(sourceName);
        if (normalized is null) return null;

        var matches = await db.Employees.AsNoTracking()
            .Where(employee => employee.FullName.ToLower() == normalized.ToLower())
            .Select(employee => employee.Id)
            .ToListAsync(cancellationToken);
        return matches.Count == 1 ? matches[0] : null;
    }

    private static Expression<Func<ProductionExternalQuantity, ProductionExternalQuantityDto>> ToProjection() => item => new ProductionExternalQuantityDto(
        item.Id, item.ProductionOrderId, item.ProductionOperationId, item.SourceEmployeeId, item.ReceivedDate, item.Quantity,
        item.SourceName, item.Note, item.CreatedAt, item.UpdatedAt);

    private static ProductionExternalQuantityDto ToDto(ProductionExternalQuantity item) => new(
        item.Id, item.ProductionOrderId, item.ProductionOperationId, item.SourceEmployeeId, item.ReceivedDate, item.Quantity,
        item.SourceName, item.Note, item.CreatedAt, item.UpdatedAt);
}
