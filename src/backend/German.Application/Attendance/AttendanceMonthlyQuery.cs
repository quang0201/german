namespace German.Application.Attendance;

public sealed record AttendanceMonthlyQuery(int Year, int Month, Guid? EmployeeId = null);
