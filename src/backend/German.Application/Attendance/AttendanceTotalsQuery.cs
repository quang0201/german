using German.Application.Abstractions;
using German.Domain.Attendance;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Attendance;

internal static class AttendanceTotalsQuery
{
    public static async Task<Dictionary<Guid, AttendanceTotalsDto>> LoadAsync(
        IGermanDbContext db,
        IReadOnlyCollection<Guid> employeeIds,
        DateOnly from,
        DateOnly until,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return [];
        }

        var totals = await db.AttendanceDays.AsNoTracking()
            .Where(day => employeeIds.Contains(day.EmployeeId) && day.WorkDate >= from && day.WorkDate <= until)
            .SelectMany(day => day.Shifts.Select(shift => new
            {
                day.EmployeeId,
                shift.ValueKind,
                shift.WorkedHours,
                shift.ScheduledHours
            }))
            .GroupBy(row => row.EmployeeId)
            .Select(group => new
            {
                EmployeeId = group.Key,
                RegularWorkedHours = group.Where(row => row.ValueKind == AttendanceShiftValueKind.Hours)
                    .Sum(row => row.WorkedHours ?? 0m),
                PaidLeaveHours = group.Where(row => row.ValueKind == AttendanceShiftValueKind.PaidLeave)
                    .Sum(row => row.ScheduledHours),
                SickLeaveHours = group.Where(row => row.ValueKind == AttendanceShiftValueKind.SickLeave)
                    .Sum(row => row.ScheduledHours)
            })
            .ToListAsync(cancellationToken);

        var overtime = await db.AttendanceDays.AsNoTracking()
            .Where(day => employeeIds.Contains(day.EmployeeId) && day.WorkDate >= from && day.WorkDate <= until)
            .GroupBy(day => day.EmployeeId)
            .Select(group => new { EmployeeId = group.Key, OvertimeHours = group.Sum(day => day.OvertimeHours) })
            .ToDictionaryAsync(row => row.EmployeeId, row => row.OvertimeHours, cancellationToken);

        var result = totals.ToDictionary(
            row => row.EmployeeId,
            row => new AttendanceTotalsDto(
                row.RegularWorkedHours,
                overtime.GetValueOrDefault(row.EmployeeId),
                row.PaidLeaveHours,
                row.SickLeaveHours));
        foreach (var row in overtime)
        {
            if (!result.ContainsKey(row.Key)) result[row.Key] = new AttendanceTotalsDto(0m, row.Value, 0m, 0m);
        }
        return result;
    }
}
