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

    public async Task<AppResult<ProductionExternalQuantityDto>> CreateAsync(CurrentActor actor, CreateProductionExternalQuantityCommand command, CancellationToken cancellationToken)
    {
        var authorization = EnsureManagerOrAdmin(actor);
        if (!authorization.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(authorization.Error!.Code, authorization.Error.Message);
        var validation = ValidateQuantity(command.Quantity);
        if (!validation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(validation.Error!.Code, validation.Error.Message);
        var referenceValidation = await ValidateReferencesAsync(command.ProductionOrderId, command.ProductionOperationId, cancellationToken);
        if (!referenceValidation.IsSuccess) return AppResult<ProductionExternalQuantityDto>.Failure(referenceValidation.Error!.Code, referenceValidation.Error.Message);

        var now = DateTimeOffset.UtcNow;
        var item = new ProductionExternalQuantity
        {
            ProductionOrderId = command.ProductionOrderId,
            ProductionOperationId = command.ProductionOperationId,
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

        item.ReceivedDate = command.ReceivedDate;
        item.Quantity = command.Quantity;
        item.SourceName = Normalize(command.SourceName);
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

    private static string? Normalize(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static Expression<Func<ProductionExternalQuantity, ProductionExternalQuantityDto>> ToProjection() => item => new ProductionExternalQuantityDto(
        item.Id, item.ProductionOrderId, item.ProductionOperationId, item.ReceivedDate, item.Quantity,
        item.SourceName, item.Note, item.CreatedAt, item.UpdatedAt);

    private static ProductionExternalQuantityDto ToDto(ProductionExternalQuantity item) => new(
        item.Id, item.ProductionOrderId, item.ProductionOperationId, item.ReceivedDate, item.Quantity,
        item.SourceName, item.Note, item.CreatedAt, item.UpdatedAt);
}
