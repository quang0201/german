using German.Domain.Production;

namespace German.Api.Contracts.ProductionEntries;

public sealed record CreateProductionEntryRequest(
    DateOnly WorkDate,
    Guid EmployeeId,
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    ProductionEntryMode EntryMode,
    decimal? Shift1Quantity = null,
    decimal? Shift2Quantity = null,
    decimal? DirectHcQuantity = null,
    decimal? DirectTcQuantity = null,
    decimal? TotalInputQuantity = null,
    decimal? OvertimeHours = null,
    decimal? OvertimeQuantity = null,
    TimeOnly? WorkStart = null,
    TimeOnly? WorkEnd = null,
    string? Note = null,
    bool ExpectedEmpty = false);
