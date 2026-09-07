namespace German.Application.ProductionEntries;

public sealed record ProductionMonthlyMatrixQuery(
    int Year,
    int Month,
    Guid? EmployeeId,
    Guid? OrderId,
    Guid? OperationId,
    string? Search,
    bool ExcludeSundays = true);

public sealed record ProductionWeeklyMatrixQuery(
    DateOnly FromDate,
    DateOnly UntilDate,
    Guid? EmployeeId,
    Guid? OrderId,
    Guid? OperationId,
    string? Search,
    bool ExcludeSundays = false);
