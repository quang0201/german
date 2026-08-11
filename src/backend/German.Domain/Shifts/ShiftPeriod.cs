using German.Domain.Common;

namespace German.Domain.Shifts;

public sealed class ShiftPeriod : Entity
{
    public Guid ShiftTemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int SortOrder { get; set; }
}
