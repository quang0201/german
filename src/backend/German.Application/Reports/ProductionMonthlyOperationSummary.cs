namespace German.Application.Reports;

public sealed record ProductionReportMonth(
    int Year,
    int Month,
    string MonthKey);

public sealed record ProductionOperationMonthSummary(
    string MonthKey,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    decimal ExternalQuantity,
    decimal CombinedTotalQuantity);

public sealed record ProductionMonthlyOperationSummary(
    Guid OperationId,
    int OperationNumber,
    string Name,
    string Unit,
    IReadOnlyList<ProductionOperationMonthSummary> Months,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    decimal ExternalQuantity,
    decimal CombinedTotalQuantity);

public sealed record ProductionMonthlyOperationSummaryReport(
    Guid OrderId,
    string OrderCode,
    string ProductName,
    int OperationCount,
    IReadOnlyList<ProductionReportMonth> Months,
    IReadOnlyList<ProductionMonthlyOperationSummary> Operations);
