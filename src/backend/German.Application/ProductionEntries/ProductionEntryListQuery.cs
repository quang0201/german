namespace German.Application.ProductionEntries;

public sealed record ProductionEntryListQuery(
    DateOnly? Date,
    DateOnly? FromDate,
    DateOnly? UntilDate,
    Guid? EmployeeId,
    Guid? OrderId,
    Guid? OperationId,
    string? Search,
    int? Page,
    int? PageSize);
