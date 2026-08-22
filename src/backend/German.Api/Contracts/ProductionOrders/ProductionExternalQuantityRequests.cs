namespace German.Api.Contracts.ProductionOrders;

public sealed record CreateProductionExternalQuantityRequest(
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    DateOnly ReceivedDate,
    decimal Quantity,
    string? SourceName = null,
    string? Note = null);

public sealed record UpdateProductionExternalQuantityRequest(
    DateOnly ReceivedDate,
    decimal Quantity,
    string? SourceName = null,
    string? Note = null);
