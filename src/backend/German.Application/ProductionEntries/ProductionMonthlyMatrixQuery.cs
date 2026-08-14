namespace German.Application.ProductionEntries;

public sealed record ProductionMonthlyMatrixQuery(
    int Year,
    int Month,
    Guid? EmployeeId,
    Guid? OrderId,
    Guid? OperationId,
    string? Search,
    bool ExcludeSundays = true);
