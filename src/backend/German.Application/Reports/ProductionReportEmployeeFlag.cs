namespace German.Application.Reports;

/// <summary>Đánh dấu nhân viên trong báo cáo: mới vào làm trong kỳ và/hoặc có sinh nhật trong tháng của kỳ.</summary>
public sealed record ProductionReportEmployeeFlag(bool IsNewEmployee, DateOnly? BirthdayThisPeriod)
{
    public bool IsHighlighted => IsNewEmployee || BirthdayThisPeriod.HasValue;

    public string Label => (IsNewEmployee, BirthdayThisPeriod) switch
    {
        (true, { } birthday) => $"Nhân viên mới; Sinh nhật: {birthday:dd/MM}",
        (true, null) => "Nhân viên mới",
        (false, { } birthday) => $"Sinh nhật: {birthday:dd/MM}",
        _ => string.Empty
    };
}
