using German.Domain.Common;

namespace German.Domain.Shifts;

public sealed class ShiftTemplate : Entity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<ShiftPeriod> Periods { get; set; } = [];
}
