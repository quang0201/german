namespace German.Application.Reports;

public sealed record ProductionReportFilter(
    DateOnly? FromDate,
    DateOnly? UntilDate,
    Guid? EmployeeId,
    Guid? OrderId,
    Guid? OperationId);
