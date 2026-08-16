using German.Domain.Common;

namespace German.Domain.Attendance;

public sealed class AttendanceShiftEntry : Entity
{
    public Guid AttendanceDayId { get; set; }
    public int SlotNumber { get; set; }
    public Guid? SourceShiftPeriodId { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public TimeOnly ScheduledStartTime { get; set; }
    public TimeOnly ScheduledEndTime { get; set; }
    public decimal ScheduledHours { get; set; }
    public AttendanceShiftValueKind ValueKind { get; set; }
    public decimal? WorkedHours { get; set; }
}
