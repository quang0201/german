namespace German.Application.Reports;

public sealed record ProductionReportDaySummary(
    DateOnly WorkDate,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);
