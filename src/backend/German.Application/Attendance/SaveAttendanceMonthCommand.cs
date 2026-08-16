using German.Domain.Attendance;

namespace German.Application.Attendance;

public sealed record SaveAttendanceMonthCommand(
    int Year,
    int Month,
    IReadOnlyList<AttendanceDayInput> Days);

public sealed record AttendanceDayInput(
    Guid EmployeeId,
    DateOnly WorkDate,
    decimal OvertimeHours,
    IReadOnlyList<AttendanceShiftInput> Shifts);

public sealed record AttendanceShiftInput(
    int SlotNumber,
    AttendanceShiftValueKind Kind,
    decimal? WorkedHours);
