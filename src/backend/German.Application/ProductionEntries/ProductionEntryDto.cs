using German.Domain.Production;

namespace German.Application.ProductionEntries;

public sealed record ProductionEntryDto(
    Guid Id,
    int Version,
    DateOnly WorkDate,
    Guid EmployeeId,
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    ProductionEntryMode EntryMode,
    decimal? Shift1Quantity,
    decimal? Shift2Quantity,
    decimal? DirectHcQuantity,
    decimal? DirectTcQuantity,
    decimal? TotalInputQuantity,
    decimal? OvertimeHours,
    decimal? OvertimeQuantity,
    TimeOnly? WorkStart,
    TimeOnly? WorkEnd,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    string? Note,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    decimal? HcHours);
