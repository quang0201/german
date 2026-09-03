namespace German.Domain.Production;

public sealed record ProductionCalculationInput(
    ProductionEntryMode Mode,
    decimal HcHours,
    decimal? Shift1Quantity = null,
    decimal? Shift2Quantity = null,
    decimal? DirectHcQuantity = null,
    decimal? DirectTcQuantity = null,
    decimal? TotalQuantity = null,
    decimal? OvertimeHours = null,
    decimal? OvertimeQuantity = null);
