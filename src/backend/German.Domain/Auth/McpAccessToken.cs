using German.Domain.Common;

namespace German.Domain.Auth;

public sealed class McpAccessToken : Entity
{
    public string TokenHash { get; set; } = string.Empty;
    public Guid IssuedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
