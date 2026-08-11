using German.Domain.Production;

namespace German.Api.Contracts.ProductionOrders;

public sealed record ProductionOperationRequest(int OperationNumber, string Name, string Unit, int SortOrder, bool IsActive = true);
public sealed record CreateProductionOrderRequest(
    string Code,
    string ProductName,
    decimal PlannedQuantity,
    ProductionOrderStatus Status,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    Guid? CloneFromOrderId = null,
    IReadOnlyList<ProductionOperationRequest>? Operations = null);
public sealed record UpdateProductionOrderRequest(
    string Code,
    string ProductName,
    decimal PlannedQuantity,
    ProductionOrderStatus Status,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null);
