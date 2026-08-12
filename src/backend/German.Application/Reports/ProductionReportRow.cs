using German.Domain.Production;

namespace German.Application.Reports;

public sealed record ProductionReportRow(
    DateOnly WorkDate,
    string EmployeeCode,
    string EmployeeName,
    string ProductionOrderCode,
    string ProductName,
    int OperationNumber,
    string OperationName,
    string Unit,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    decimal? OvertimeHours,
    ProductionEntryMode EntryMode,
    string? Note);
