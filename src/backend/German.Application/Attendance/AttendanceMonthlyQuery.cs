namespace German.Application.Attendance;

public sealed record AttendanceMonthlyQuery(
    int Year,
    int Month,
    Guid? EmployeeId = null,
    string? EmployeeCursor = null,
    int EmployeeLimit = 20,
    IReadOnlyCollection<Guid>? EmployeeIds = null);
