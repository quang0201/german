namespace German.Application.Attendance;

public sealed record AttendanceHoursDto(
    Guid EmployeeId,
    DateOnly WorkDate,
    bool HasAttendance,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal PaidLeaveHours,
    decimal SickLeaveHours);
