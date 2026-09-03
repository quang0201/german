namespace German.Application.Reports;

public sealed record ProductionReportSummary(
    int EmployeeCount,
    int EntryCount,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);
