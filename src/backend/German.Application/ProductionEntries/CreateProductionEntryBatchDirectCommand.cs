using German.Application.Attendance;

namespace German.Application.ProductionEntries;

public sealed record CreateProductionEntryBatchDirectItem(
    Guid ProductionOperationId,
    decimal? DirectHcQuantity,
    decimal? DirectTcQuantity,
    string? Note);

public sealed record CreateProductionEntryBatchDirectCommand(
    DateOnly WorkDate,
    Guid EmployeeId,
    Guid ProductionOrderId,
    IReadOnlyList<CreateProductionEntryBatchDirectItem> Items,
    AttendanceDayInput? Attendance = null);

public sealed record CreateProductionEntryBatchDirectResult(
    int CreatedCount,
    IReadOnlyList<ProductionEntryDto> Entries);
