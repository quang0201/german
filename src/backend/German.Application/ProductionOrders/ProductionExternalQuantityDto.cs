namespace German.Application.ProductionOrders;

public sealed record ProductionExternalQuantityDto(
    Guid Id,
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    DateOnly ReceivedDate,
    decimal Quantity,
    string? SourceName,
    string? Note,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateProductionExternalQuantityCommand(
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    DateOnly ReceivedDate,
    decimal Quantity,
    string? SourceName,
    string? Note);

public sealed record UpdateProductionExternalQuantityCommand(
    DateOnly ReceivedDate,
    decimal Quantity,
    string? SourceName,
    string? Note);
