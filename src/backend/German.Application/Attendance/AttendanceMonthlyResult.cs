using German.Domain.Attendance;

namespace German.Application.Attendance;

public sealed record AttendanceMonthlyResult(
    int Year,
    int Month,
    IReadOnlyList<AttendanceEmployeeMonthDto> Employees,
    string? EmployeeCursor,
    int EmployeeLimit,
    string? NextEmployeeCursor,
    bool HasMoreEmployees,
    int DayFrom,
    int DayTo,
    bool HasMoreDays);

public sealed record AttendanceEmployeeMonthDto(
    Guid EmployeeId,
    string EmployeeCode,
    string FullName,
    IReadOnlyList<AttendanceDayDto> Days,
    AttendanceTotalsDto Totals);

public sealed record AttendanceDayDto(
    DateOnly WorkDate,
    bool HasAttendance,
    bool HasShiftSetup,
    decimal OvertimeHours,
    IReadOnlyList<AttendanceShiftDto> Shifts);

public sealed record AttendanceShiftDto(
    int SlotNumber,
    Guid? SourceShiftPeriodId,
    string ShiftName,
    TimeOnly ScheduledStartTime,
    TimeOnly ScheduledEndTime,
    decimal ScheduledHours,
    AttendanceShiftValueKind ValueKind,
    decimal? WorkedHours);

public sealed record AttendanceTotalsDto(
    decimal RegularWorkedHours,
    decimal OvertimeHours,
    decimal PaidLeaveHours,
    decimal SickLeaveHours);
