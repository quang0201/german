using German.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Attendance;

public sealed class AttendanceExportService(
    IGermanDbContext db,
    IAttendanceExcelExporter exporter)
{
    public async Task<byte[]> ExportAsync(int year, int month, CancellationToken cancellationToken)
    {
        var monthFrom = new DateOnly(year, month, 1);
        var monthUntil = monthFrom.AddMonths(1).AddDays(-1);
        var employees = await db.Employees
            .AsNoTracking()
            .Where(employee => employee.IsActive || db.AttendanceDays.Any(day =>
                day.EmployeeId == employee.Id
                && day.WorkDate >= monthFrom
                && day.WorkDate <= monthUntil))
            .OrderBy(employee => employee.EmployeeCode)
            .ThenBy(employee => employee.Id)
            .ToListAsync(cancellationToken);

        var employeeIds = employees.Select(employee => employee.Id).ToArray();
        var attendance = await db.AttendanceDays
            .AsNoTracking()
            .Include(day => day.Shifts)
            .Where(day => employeeIds.Contains(day.EmployeeId)
                && day.WorkDate >= monthFrom
                && day.WorkDate <= monthUntil)
            .OrderBy(day => day.WorkDate)
            .ToListAsync(cancellationToken);
        var totals = await AttendanceTotalsQuery.LoadAsync(db, employeeIds, monthFrom, monthUntil, cancellationToken);
        var daysByEmployee = attendance
            .GroupBy(day => day.EmployeeId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var data = employees.Select(employee => new AttendanceExportEmployee(
            employee.Id,
            employee.EmployeeCode,
            employee.FullName,
            daysByEmployee.GetValueOrDefault(employee.Id, []).Select(day => new AttendanceExportDay(
                day.WorkDate,
                day.OvertimeHours,
                day.Note,
                day.Shifts.OrderBy(shift => shift.SlotNumber).Select(shift => new AttendanceExportShift(
                    shift.SlotNumber,
                    shift.ScheduledHours,
                    shift.ValueKind,
                    shift.WorkedHours)).ToList())).ToList(),
            totals.GetValueOrDefault(employee.Id, AttendanceTotalsDto.Empty))).ToList();

        return exporter.Export(new AttendanceExportData(year, month, data));
    }
}
