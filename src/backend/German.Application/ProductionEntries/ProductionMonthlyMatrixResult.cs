using German.Domain.Production;

namespace German.Application.ProductionEntries;

public sealed record ProductionMonthlyMatrixSummary(
    int EmployeeCount,
    int EntryCount,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity);

public sealed record ProductionMatrixRecordDto(
    Guid Id,
    int Version,
    ProductionEntryMode EntryMode,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    string? Note);

public sealed record ProductionMatrixCellDto(
    DateOnly WorkDate,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    int EntryCount,
    IReadOnlyList<ProductionMatrixRecordDto> Records);

public sealed record ProductionMatrixOperationRowDto(
    Guid OperationId,
    int OperationNumber,
    string OperationName,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    IReadOnlyList<ProductionMatrixCellDto> Cells);

public sealed record ProductionMatrixEmployeeGroupDto(
    Guid EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    bool IsActive,
    IReadOnlyList<ProductionMatrixOperationRowDto> Operations);

public sealed record ProductionMatrixOrderBlockDto(
    Guid OrderId,
    string OrderCode,
    string ProductName,
    IReadOnlyList<ProductionMatrixEmployeeGroupDto> Employees);

public sealed record ProductionMatrixOrderOptionDto(Guid Id, string Code, string ProductName);

public sealed record ProductionMonthlyMatrixResult(
    DateOnly FromDate,
    DateOnly UntilDate,
    bool ExcludeSundays,
    ProductionMonthlyMatrixSummary Summary,
    IReadOnlyList<ProductionMatrixOrderOptionDto> AvailableOrders,
    IReadOnlyList<ProductionMatrixOrderBlockDto> Orders);
