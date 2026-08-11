using German.Domain.Production;

namespace German.Application.ProductionEntries;

public sealed record ProductionEntryListItemDto(
    Guid Id,
    int Version,
    DateOnly WorkDate,
    Guid EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    Guid ProductionOrderId,
    string ProductionOrderCode,
    string ProductName,
    Guid ProductionOperationId,
    int OperationNumber,
    string OperationName,
    string Unit,
    ProductionEntryMode EntryMode,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    decimal? OvertimeHours,
    TimeOnly? WorkStart,
    TimeOnly? WorkEnd,
    string? Note,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
