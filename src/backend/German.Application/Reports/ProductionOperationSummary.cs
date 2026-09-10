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
    decimal CombinedTotalQuantity,
    IReadOnlyList<ProductionOperationEmployeeSummary> Contributors);

public sealed record ProductionOperationEmployeeSummary(
    string EmployeeCode,
    string EmployeeName,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    bool IsExternal = false)
{
    public IReadOnlyList<ProductionOperationEmployeeDaySummary> DailyTotals { get; init; } = [];
}

public sealed record ProductionOperationEmployeeDaySummary(
    DateOnly WorkDate,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);

public sealed record ProductionOperationSummaryReport(
    Guid OrderId,
    string OrderCode,
    string ProductName,
    int OperationCount,
    IReadOnlyList<ProductionOperationSummary> Operations);
