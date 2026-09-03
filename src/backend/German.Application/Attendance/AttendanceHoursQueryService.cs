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
            var assignment = await db.EmployeeShiftAssignments.AsNoTracking()
                .Where(item => item.EmployeeId == employeeId
                    && item.EffectiveFrom <= workDate
                    && (item.EffectiveTo == null || item.EffectiveTo >= workDate))
                .OrderByDescending(item => item.EffectiveFrom)
                .FirstOrDefaultAsync(cancellationToken);
            if (assignment is null)
            {
                return new AttendanceHoursDto(employeeId, workDate, false, 0m, 0m, 0m, 0m, []);
            }

            var scheduledPeriods = await db.ShiftPeriods.AsNoTracking()
                .Where(item => item.ShiftTemplateId == assignment.ShiftTemplateId)
                .OrderBy(item => item.SortOrder)
                .ToListAsync(cancellationToken);
            var scheduledShifts = scheduledPeriods
                .Select((item, index) => new AttendanceShiftHoursDto(index + 1, item.Name, 0m))
                .ToList();
            return new AttendanceHoursDto(employeeId, workDate, false, 0m, 0m, 0m, 0m, scheduledShifts);
        }

        var workedShifts = day.Shifts
            .Where(x => x.ValueKind == AttendanceShiftValueKind.Hours)
            .OrderBy(x => x.SlotNumber)
            .Select(x => new AttendanceShiftHoursDto(x.SlotNumber, x.ShiftName, x.WorkedHours ?? 0m))
            .ToList();

        return new AttendanceHoursDto(
            employeeId,
            workDate,
            true,
            day.Shifts.Where(x => x.ValueKind == AttendanceShiftValueKind.Hours).Sum(x => x.WorkedHours ?? 0m),
            day.OvertimeHours,
            day.Shifts.Where(x => x.ValueKind == AttendanceShiftValueKind.PaidLeave).Sum(x => x.ScheduledHours),
            day.Shifts.Where(x => x.ValueKind == AttendanceShiftValueKind.SickLeave).Sum(x => x.ScheduledHours),
            workedShifts);
    }
}
