namespace German.Api.Contracts.ProductionEntries;

public sealed record CreateProductionEntryBatchDirectItemRequest(Guid ProductionOperationId, decimal? DirectHcQuantity, decimal? DirectTcQuantity, string? Note);
public sealed record CreateProductionEntryBatchDirectRequest(DateOnly WorkDate, Guid EmployeeId, Guid ProductionOrderId, IReadOnlyList<CreateProductionEntryBatchDirectItemRequest> Items);
