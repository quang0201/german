using German.Domain.Production;

namespace German.Application.ProductionOrders;

public sealed record ProductionOperationInput(int OperationNumber, string Name, string Unit, int SortOrder, bool IsActive = true, decimal? FixedPrice = null);
public sealed record CreateProductionOrderCommand(
    string Code,
    string ProductName,
    decimal PlannedQuantity,
    ProductionOrderStatus Status,
    DateOnly? StartDate,
    DateOnly? EndDate,
    Guid? CloneFromOrderId,
    IReadOnlyList<ProductionOperationInput>? Operations,
    Guid? ProductId = null);
public sealed record UpdateProductionOrderCommand(
    string Code,
    string ProductName,
    decimal PlannedQuantity,
    ProductionOrderStatus Status,
    DateOnly? StartDate,
    DateOnly? EndDate,
    Guid? ProductId = null,
    bool ClearProduct = false);
public sealed record ProductionOperationDto(Guid Id, int OperationNumber, string Name, string Unit, decimal? FixedPrice, int SortOrder, bool IsActive);
public sealed record ProductionOrderDto(
    Guid Id,
    string Code,
    string ProductName,
    decimal PlannedQuantity,
    ProductionOrderStatus Status,
    DateOnly? StartDate,
    DateOnly? EndDate,
    IReadOnlyList<ProductionOperationDto> Operations,
    Guid? ProductId = null,
    string? ProductCode = null);
