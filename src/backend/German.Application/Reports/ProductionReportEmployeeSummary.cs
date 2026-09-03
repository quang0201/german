namespace German.Application.Reports;

public sealed record ProductionReportEmployeeSummary(
    string EmployeeCode,
    string EmployeeName,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);
