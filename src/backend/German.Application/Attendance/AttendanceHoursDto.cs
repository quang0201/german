using German.Domain.Attendance;

namespace German.Application.Attendance;

public sealed record AttendanceShiftHoursDto(
    int SlotNumber,
    string ShiftName,
    decimal WorkedHours,
    AttendanceShiftValueKind ValueKind);

public sealed record AttendanceHoursDto(
    Guid EmployeeId,
    DateOnly WorkDate,
    bool HasAttendance,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal PaidLeaveHours,
    decimal SickLeaveHours,
    IReadOnlyList<AttendanceShiftHoursDto> Shifts);
