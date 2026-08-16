using German.Domain.Attendance;

namespace German.Application.Attendance;

public sealed record AttendanceExportData(
    int Year,
    int Month,
    IReadOnlyList<AttendanceExportEmployee> Employees);

public sealed record AttendanceExportEmployee(
    Guid EmployeeId,
    string EmployeeCode,
    string FullName,
    IReadOnlyList<AttendanceExportDay> Days,
    AttendanceTotalsDto Totals);

public sealed record AttendanceExportDay(
    DateOnly WorkDate,
    decimal OvertimeHours,
    string Note,
    IReadOnlyList<AttendanceExportShift> Shifts);

public sealed record AttendanceExportShift(
    int SlotNumber,
    decimal ScheduledHours,
    AttendanceShiftValueKind ValueKind,
    decimal? WorkedHours);

public interface IAttendanceExcelExporter
{
    byte[] Export(AttendanceExportData data);
}
