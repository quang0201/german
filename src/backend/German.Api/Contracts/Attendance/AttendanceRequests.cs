using German.Domain.Attendance;

namespace German.Api.Contracts.Attendance;

public sealed record AttendanceShiftRequest(
    int SlotNumber,
    AttendanceShiftValueKind Kind,
    decimal? WorkedHours);

public sealed record AttendanceDayRequest(
    Guid EmployeeId,
    DateOnly WorkDate,
    decimal OvertimeHours,
    IReadOnlyList<AttendanceShiftRequest> Shifts);

public sealed record SaveAttendanceMonthRequest(
    int Year,
    int Month,
    IReadOnlyList<AttendanceDayRequest> Days);
