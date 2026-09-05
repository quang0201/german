using German.Domain.Common;

namespace German.Domain.Production;

public sealed class ProductionExternalSource : Entity
{
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
