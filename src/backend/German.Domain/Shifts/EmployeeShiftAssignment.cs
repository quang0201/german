using German.Domain.Common;

namespace German.Domain.Shifts;

public sealed class EmployeeShiftAssignment : Entity
{
    public Guid EmployeeId { get; set; }
    public Guid ShiftTemplateId { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}
