using German.Domain.Common;

namespace German.Domain.Production;

public sealed class ProductionExternalQuantity : Entity
{
    public Guid ProductionOrderId { get; set; }
    public Guid ProductionOperationId { get; set; }
    public DateOnly ReceivedDate { get; set; }
    public decimal Quantity { get; set; }
    public string? SourceName { get; set; }
    public string? Note { get; set; }
    public Guid SubmittedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
