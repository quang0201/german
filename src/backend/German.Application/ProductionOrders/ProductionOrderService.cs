using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionOrders;

public sealed class ProductionOrderService(IGermanDbContext db)
{
    public async Task<AppResult<ProductionOrderDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.ProductionOrders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return AppResult<ProductionOrderDto>.Failure("production_order.not_found", "Không tìm thấy mã sản xuất.");
        }

        var operations = await db.ProductionOperations.AsNoTracking()
            .Where(x => x.ProductionOrderId == id)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);
        return AppResult<ProductionOrderDto>.Success(ToDto(order, operations));
    }

    public async Task<IReadOnlyList<ProductionOrderDto>> ListAsync(CancellationToken cancellationToken)
    {
        var orders = await db.ProductionOrders.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        var orderIds = orders.Select(x => x.Id).ToArray();
        var operations = await db.ProductionOperations.AsNoTracking()
            .Where(x => orderIds.Contains(x.ProductionOrderId))
            .OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);
        return orders.Select(order => ToDto(order, operations.Where(x => x.ProductionOrderId == order.Id))).ToList();
    }

    public async Task<AppResult<ProductionOrderDto>> CreateAsync(CreateProductionOrderCommand command, CancellationToken cancellationToken)
    {
        var validation = ValidateOrder(command.Code, command.ProductName, command.PlannedQuantity, command.StartDate, command.EndDate);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductionOrderDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var normalizedCode = command.Code.Trim().ToUpperInvariant();
        if (await db.ProductionOrders.AnyAsync(x => x.Code.ToUpper() == normalizedCode, cancellationToken))
        {
            return AppResult<ProductionOrderDto>.Failure("production_order.duplicate_code", "Mã sản xuất đã tồn tại.");
        }

        if (command.CloneFromOrderId.HasValue && command.Operations is { Count: > 0 })
        {
            return AppResult<ProductionOrderDto>.Failure("production_order.invalid_operations", "Chỉ chọn clone hoặc nhập danh sách công đoạn mới.");
        }

        List<ProductionOperation> sourceOperations = [];
        if (command.CloneFromOrderId.HasValue)
        {
            if (!await db.ProductionOrders.AnyAsync(x => x.Id == command.CloneFromOrderId.Value, cancellationToken))
            {
                return AppResult<ProductionOrderDto>.Failure("production_order.clone_source_not_found", "Không tìm thấy mã sản xuất nguồn.");
            }

            sourceOperations = await db.ProductionOperations.AsNoTracking()
                .Where(x => x.ProductionOrderId == command.CloneFromOrderId.Value)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(cancellationToken);
        }

        var operationInputs = command.CloneFromOrderId.HasValue
            ? sourceOperations.Select(x => new ProductionOperationInput(x.OperationNumber, x.Name, x.Unit, x.SortOrder, x.IsActive, x.FixedPrice)).ToList()
            : command.Operations?.ToList() ?? [];

        var operationValidation = ValidateOperations(operationInputs);
        if (!operationValidation.IsSuccess)
        {
            return AppResult<ProductionOrderDto>.Failure(operationValidation.Error!.Code, operationValidation.Error.Message);
        }

        var order = new ProductionOrder
        {
            Code = command.Code.Trim(),
            ProductName = command.ProductName.Trim(),
            PlannedQuantity = command.PlannedQuantity,
            Status = command.Status,
            StartDate = command.StartDate,
            EndDate = command.EndDate
        };
        foreach (var input in operationInputs.OrderBy(x => x.SortOrder))
        {
            order.Operations.Add(new ProductionOperation
            {
                ProductionOrderId = order.Id,
                OperationNumber = input.OperationNumber,
                Name = input.Name.Trim(),
                Unit = input.Unit.Trim(),
                FixedPrice = input.FixedPrice,
                SortOrder = input.SortOrder,
                IsActive = input.IsActive
            });
        }

        db.ProductionOrders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionOrderDto>.Success(ToDto(order, order.Operations));
    }

    public async Task<AppResult<ProductionOrderDto>> UpdateAsync(Guid id, UpdateProductionOrderCommand command, CancellationToken cancellationToken)
    {
        var order = await db.ProductionOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return AppResult<ProductionOrderDto>.Failure("production_order.not_found", "Không tìm thấy mã sản xuất.");
        }

        var validation = ValidateOrder(command.Code, command.ProductName, command.PlannedQuantity, command.StartDate, command.EndDate);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductionOrderDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var normalizedCode = command.Code.Trim().ToUpperInvariant();
        if (await db.ProductionOrders.AnyAsync(x => x.Id != id && x.Code.ToUpper() == normalizedCode, cancellationToken))
        {
            return AppResult<ProductionOrderDto>.Failure("production_order.duplicate_code", "Mã sản xuất đã tồn tại.");
        }

        order.Code = command.Code.Trim();
        order.ProductName = command.ProductName.Trim();
        order.PlannedQuantity = command.PlannedQuantity;
        order.Status = command.Status;
        order.StartDate = command.StartDate;
        order.EndDate = command.EndDate;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var operations = await db.ProductionOperations.AsNoTracking().Where(x => x.ProductionOrderId == id).ToListAsync(cancellationToken);
        return AppResult<ProductionOrderDto>.Success(ToDto(order, operations));
    }

    public async Task<AppResult<ProductionOperationDto>> AddOperationAsync(Guid orderId, ProductionOperationInput input, CancellationToken cancellationToken)
    {
        if (!await db.ProductionOrders.AnyAsync(x => x.Id == orderId, cancellationToken))
        {
            return AppResult<ProductionOperationDto>.Failure("production_order.not_found", "Không tìm thấy mã sản xuất.");
        }

        var validation = ValidateOperations([input]);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductionOperationDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        if (await db.ProductionOperations.AnyAsync(x => x.ProductionOrderId == orderId && x.OperationNumber == input.OperationNumber, cancellationToken))
        {
            return AppResult<ProductionOperationDto>.Failure("production_operation.duplicate_number", "Số công đoạn đã tồn tại trong mã sản xuất.");
        }

        var operation = new ProductionOperation
        {
            ProductionOrderId = orderId,
            OperationNumber = input.OperationNumber,
            Name = input.Name.Trim(),
            Unit = input.Unit.Trim(),
            FixedPrice = input.FixedPrice,
            SortOrder = input.SortOrder,
            IsActive = input.IsActive
        };
        db.ProductionOperations.Add(operation);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionOperationDto>.Success(ToDto(operation));
    }

    public async Task<AppResult<ProductionOperationDto>> UpdateOperationAsync(Guid orderId, Guid operationId, ProductionOperationInput input, CancellationToken cancellationToken)
    {
        var operation = await db.ProductionOperations.FirstOrDefaultAsync(x => x.Id == operationId && x.ProductionOrderId == orderId, cancellationToken);
        if (operation is null)
        {
            return AppResult<ProductionOperationDto>.Failure("production_operation.not_found", "Không tìm thấy công đoạn.");
        }

        var validation = ValidateOperations([input]);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductionOperationDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        if (await db.ProductionOperations.AnyAsync(x => x.Id != operationId && x.ProductionOrderId == orderId && x.OperationNumber == input.OperationNumber, cancellationToken))
        {
            return AppResult<ProductionOperationDto>.Failure("production_operation.duplicate_number", "Số công đoạn đã tồn tại trong mã sản xuất.");
        }

        operation.OperationNumber = input.OperationNumber;
        operation.Name = input.Name.Trim();
        operation.Unit = input.Unit.Trim();
        operation.FixedPrice = input.FixedPrice;
        operation.SortOrder = input.SortOrder;
        operation.IsActive = input.IsActive;
        operation.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionOperationDto>.Success(ToDto(operation));
    }

    public async Task<AppResult> Cleanup0417Operation567Async(CancellationToken cancellationToken)
    {
        var order = await db.ProductionOrders
            .FirstOrDefaultAsync(x => x.Code == "0417", cancellationToken);
        var operation = order is null
            ? null
            : await db.ProductionOperations.FirstOrDefaultAsync(
                x => x.ProductionOrderId == order.Id && x.OperationNumber == 567,
                cancellationToken);
        if (operation is null)
        {
            return AppResult.Failure("production_operation.not_found", "Không tìm thấy CĐ567 trong Mã SX 0417.");
        }

        var entries = await db.ProductionEntries
            .IgnoreQueryFilters()
            .Where(x => x.ProductionOperationId == operation.Id)
            .ToListAsync(cancellationToken);

        db.ProductionEntries.RemoveRange(entries);
        db.ProductionOperations.Remove(operation);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult.Success();
    }

    private static AppResult ValidateOrder(string code, string productName, decimal plannedQuantity, DateOnly? startDate, DateOnly? endDate)
    {
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(productName) || plannedQuantity < 0m)
        {
            return AppResult.Failure("production_order.invalid_input", "Mã sản xuất, tên sản phẩm và sản lượng kế hoạch phải hợp lệ.");
        }
        if (startDate.HasValue && endDate.HasValue && endDate.Value < startDate.Value)
        {
            return AppResult.Failure("production_order.invalid_dates", "Ngày kết thúc không được trước ngày bắt đầu.");
        }
        return AppResult.Success();
    }

    private static AppResult ValidateOperations(IReadOnlyList<ProductionOperationInput> operations)
    {
        if (operations.GroupBy(x => x.OperationNumber).Any(group => group.Count() > 1))
        {
            return AppResult.Failure("production_operation.duplicate_number", "Danh sách có số công đoạn bị trùng.");
        }
        if (operations.Any(x => x.OperationNumber <= 0 || string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.Unit) || x.FixedPrice < 0m))
        {
            return AppResult.Failure(
                operations.Any(x => x.FixedPrice < 0m) ? "production_operation.invalid_price" : "production_operation.invalid_input",
                operations.Any(x => x.FixedPrice < 0m) ? "Giá cố định không được âm." : "Số công đoạn, tên và đơn vị tính phải hợp lệ.");
        }
        return AppResult.Success();
    }

    private static ProductionOrderDto ToDto(ProductionOrder order, IEnumerable<ProductionOperation> source) =>
        new(order.Id, order.Code, order.ProductName, order.PlannedQuantity, order.Status, order.StartDate, order.EndDate,
            source.OrderBy(x => x.SortOrder).Select(ToDto).ToList());

    private static ProductionOperationDto ToDto(ProductionOperation operation) =>
        new(operation.Id, operation.OperationNumber, operation.Name, operation.Unit, operation.FixedPrice, operation.SortOrder, operation.IsActive);
}
