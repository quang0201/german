namespace German.Application.Attendance;

internal static class AttendanceMonthValidator
{
    public static void Validate(int year, int month)
    {
        if (!IsValid(year, month))
        {
            throw new ArgumentOutOfRangeException(nameof(month), "Tháng chấm công không hợp lệ.");
        }
    }

    public static bool IsValid(int year, int month) => year is >= 2000 and <= 2100 && month is >= 1 and <= 12;
}
