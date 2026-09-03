using German.Domain.Common;

namespace German.Domain.Production;

public sealed class ProductionOperation : Entity
{
    public Guid ProductionOrderId { get; set; }
    public int OperationNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal? FixedPrice { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
