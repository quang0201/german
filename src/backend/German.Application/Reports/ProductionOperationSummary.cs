namespace German.Application.Reports;

public sealed record ProductionOperationSummary(
    Guid OperationId,
    int OperationNumber,
    string Name,
    string Unit,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    decimal ExternalQuantity,
    decimal CombinedTotalQuantity);

public sealed record ProductionOperationSummaryReport(
    Guid OrderId,
    string OrderCode,
    string ProductName,
    int OperationCount,
    IReadOnlyList<ProductionOperationSummary> Operations);
