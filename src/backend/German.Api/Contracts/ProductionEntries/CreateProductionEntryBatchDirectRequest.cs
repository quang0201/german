using German.Api.Contracts.Attendance;

namespace German.Api.Contracts.ProductionEntries;

public sealed record CreateProductionEntryBatchDirectItemRequest(
    Guid ProductionOperationId,
    decimal? DirectHcQuantity,
    decimal? DirectTcQuantity,
    string? Note);

public sealed class CreateProductionEntryBatchDirectRequest
{
    public DateOnly WorkDate { get; init; }
    public Guid EmployeeId { get; init; }
    public Guid ProductionOrderId { get; init; }
    public AttendanceDayRequest? Attendance { get; init; }
    public IReadOnlyList<CreateProductionEntryBatchDirectItemRequest> Items { get; init; } = Array.Empty<CreateProductionEntryBatchDirectItemRequest>();
}
