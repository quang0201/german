using German.Domain.Production;

namespace German.Application.Common;

public static class ProductionEntrySearch
{
    public static ProductionEntrySearchCriteria? Normalize(string? search)
    {
        if (search?.Trim() is not { Length: > 0 } text)
        {
            return null;
        }

        var loweredText = text.ToLowerInvariant();
        var entryModes = new HashSet<ProductionEntryMode>();
        if (loweredText is "byshift" or "theo ca") entryModes.Add(ProductionEntryMode.ByShift);
        if (loweredText is "direct" or "hc / tc trực tiếp" or "hc/tc trực tiếp") entryModes.Add(ProductionEntryMode.Direct);
        if (loweredText is "totalwithovertime" or "tổng + giờ tc" or "tổng + giờ tăng ca") entryModes.Add(ProductionEntryMode.TotalWithOvertime);

        return new ProductionEntrySearchCriteria(text, loweredText, entryModes);
    }
}

public sealed record ProductionEntrySearchCriteria(
    string Text,
    string LoweredText,
    IReadOnlySet<ProductionEntryMode> EntryModes);
