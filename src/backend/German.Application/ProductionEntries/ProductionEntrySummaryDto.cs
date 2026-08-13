namespace German.Application.ProductionEntries;

public sealed record ProductionEntrySummaryDto(
    int EmployeeCount,
    int EntryCount,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);
