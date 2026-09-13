namespace German.Application.Reports;

public sealed record ProductionReportEmployeeDaySummary(
    DateOnly WorkDate,
    string EmployeeCode,
    string EmployeeName,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);

public sealed record ProductionReportOrderDaySummary(
    DateOnly WorkDate,
    string ProductionOrderCode,
    string ProductName,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);

public sealed record ProductionReportWorkHourSummary(
    DateOnly WorkDate,
    string EmployeeCode,
    string EmployeeName,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal PaidLeaveHours,
    decimal SickLeaveHours,
    string Note)
{
    public decimal TotalHours => RegularHours + OvertimeHours;
}
