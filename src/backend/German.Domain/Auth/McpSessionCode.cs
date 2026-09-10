using German.Domain.Common;

namespace German.Domain.Auth;

public sealed class McpSessionCode : Entity
{
    public string CodeHash { get; set; } = string.Empty;
    public Guid IssuedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
}
