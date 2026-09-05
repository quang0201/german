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

public sealed record ProductionExternalQuantitySummaryDto(
    string SourceName,
    decimal TotalQuantity,
    IReadOnlyList<ProductionExternalQuantityOperationSummaryDto> Operations,
    IReadOnlyList<ProductionExternalQuantityUnitSummaryDto> TotalsByUnit);

public sealed record ProductionExternalQuantityOperationSummaryDto(
    Guid ProductionOperationId,
    int OperationNumber,
    string OperationName,
    string Unit,
    decimal Quantity);

public sealed record ProductionExternalQuantityUnitSummaryDto(
    string Unit,
    decimal Quantity);

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
