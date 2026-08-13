namespace German.Application.ProductionEntries;

public sealed record ProductionEntryListResult(
    IReadOnlyList<ProductionEntryListItemDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    ProductionEntrySummaryDto Summary);
