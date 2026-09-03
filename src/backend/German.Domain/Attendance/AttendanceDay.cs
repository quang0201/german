using German.Domain.Common;

namespace German.Domain.Attendance;

public sealed class AttendanceDay : Entity
{
    public Guid EmployeeId { get; set; }
    public DateOnly WorkDate { get; set; }
    public decimal OvertimeHours { get; set; }
    public string Note { get; set; } = string.Empty;
    public List<AttendanceShiftEntry> Shifts { get; set; } = [];
}
