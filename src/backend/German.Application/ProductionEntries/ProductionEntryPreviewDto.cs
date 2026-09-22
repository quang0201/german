namespace German.Application.ProductionEntries;

public sealed record ProductionEntryPreviewDto(
    DateOnly WorkDate,
    Guid EmployeeId,
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);
