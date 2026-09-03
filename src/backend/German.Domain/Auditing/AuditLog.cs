using German.Domain.Common;

namespace German.Domain.Auditing;

public sealed class AuditLog : Entity
{
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public AuditAction Action { get; set; }
    public Guid PerformedByUserId { get; set; }
    public DateTimeOffset PerformedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
}
