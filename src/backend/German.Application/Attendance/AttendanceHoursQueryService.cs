using German.Application.Abstractions;
using German.Domain.Attendance;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Attendance;

public sealed class AttendanceHoursQueryService(IGermanDbContext db)
{
    public async Task<AttendanceHoursDto> GetAsync(
        Guid employeeId,
        DateOnly workDate,
        CancellationToken cancellationToken)
    {
        var day = await db.AttendanceDays.AsNoTracking()
            .Include(x => x.Shifts)
            .SingleOrDefaultAsync(x => x.EmployeeId == employeeId && x.WorkDate == workDate, cancellationToken);

        if (day is null)
        {
            return new AttendanceHoursDto(employeeId, workDate, false, 0m, 0m, 0m, 0m);
        }

        return new AttendanceHoursDto(
            employeeId,
            workDate,
            true,
            day.Shifts.Where(x => x.ValueKind == AttendanceShiftValueKind.Hours).Sum(x => x.WorkedHours ?? 0m),
            day.OvertimeHours,
            day.Shifts.Where(x => x.ValueKind == AttendanceShiftValueKind.PaidLeave).Sum(x => x.ScheduledHours),
            day.Shifts.Where(x => x.ValueKind == AttendanceShiftValueKind.SickLeave).Sum(x => x.ScheduledHours));
    }
}
