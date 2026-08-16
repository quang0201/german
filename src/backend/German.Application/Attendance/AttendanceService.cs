using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Attendance;
using German.Domain.Employees;
using German.Domain.Shifts;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;

namespace German.Application.Attendance;

public sealed class AttendanceService(IGermanDbContext db)
{
    public async Task<AttendanceMonthlyResult> GetMonthAsync(
        AttendanceMonthlyQuery query,
        CancellationToken cancellationToken)
    {
        ValidateMonth(query.Year, query.Month);
        var employeeCursor = query.EmployeeIds is null ? ParseEmployeeCursor(query.EmployeeCursor) : null;
        var employeeLimit = query.EmployeeIds is null
            ? ValidateEmployeeLimit(query.EmployeeLimit)
            : Math.Max(query.EmployeeIds.Count, 1);
        var from = new DateOnly(query.Year, query.Month, 1);
        var until = from.AddMonths(1).AddDays(-1);

        var employeesQuery = db.Employees.AsNoTracking();
        if (query.EmployeeIds is not null)
        {
            employeesQuery = employeesQuery.Where(x => query.EmployeeIds.Contains(x.Id));
        }
        else
        {
            employeesQuery = employeesQuery.Where(x => x.IsActive || db.AttendanceDays.Any(attendance =>
                attendance.EmployeeId == x.Id
                && attendance.WorkDate >= from
                && attendance.WorkDate <= until));
            if (query.EmployeeId.HasValue)
            {
                employeesQuery = employeesQuery.Where(x => x.Id == query.EmployeeId.Value);
            }
            if (employeeCursor is not null)
            {
                employeesQuery = employeesQuery.Where(x =>
                    string.Compare(x.EmployeeCode, employeeCursor.EmployeeCode) > 0
                    || (x.EmployeeCode == employeeCursor.EmployeeCode && x.Id.CompareTo(employeeCursor.EmployeeId) > 0));
            }
        }

        var orderedEmployeesQuery = employeesQuery
            .OrderBy(x => x.EmployeeCode)
            .ThenBy(x => x.Id);
        var employeeCandidates = await orderedEmployeesQuery
            .Take(query.EmployeeIds is null ? employeeLimit + 1 : employeeLimit)
            .ToListAsync(cancellationToken);
        var hasMoreEmployees = query.EmployeeIds is null && employeeCandidates.Count > employeeLimit;
        var employees = employeeCandidates.Take(employeeLimit).ToList();
        var employeeIds = employees.Select(x => x.Id).ToArray();
        var savedDays = await db.AttendanceDays.AsNoTracking()
            .Include(x => x.Shifts)
            .Where(x => employeeIds.Contains(x.EmployeeId) && x.WorkDate >= from && x.WorkDate <= until)
            .ToListAsync(cancellationToken);
        var scheduleContext = await LoadScheduleContextAsync(employeeIds, from, until, cancellationToken);

        var resultEmployees = new List<AttendanceEmployeeMonthDto>(employees.Count);
        foreach (var employee in employees)
        {
            var employeeDays = savedDays.Where(x => x.EmployeeId == employee.Id)
                .ToDictionary(x => x.WorkDate);
            var days = new List<AttendanceDayDto>(until.Day);
            for (var date = from; date <= until; date = date.AddDays(1))
            {
                if (employeeDays.TryGetValue(date, out var savedDay))
                {
                    days.Add(ToDayDto(savedDay));
                    continue;
                }

                var slots = ResolveCurrentSlots(employee.Id, date, scheduleContext);
                days.Add(new AttendanceDayDto(date, false, slots.Count > 0, 0m, slots));
            }

            resultEmployees.Add(new AttendanceEmployeeMonthDto(
                employee.Id,
                employee.EmployeeCode,
                employee.FullName,
                days,
                CalculateTotals(days)));
        }

        var nextEmployeeCursor = hasMoreEmployees && employees.Count > 0
            ? EncodeEmployeeCursor(employees[^1])
            : null;
        return new AttendanceMonthlyResult(
            query.Year,
            query.Month,
            resultEmployees,
            query.EmployeeCursor,
            employeeLimit,
            nextEmployeeCursor,
            hasMoreEmployees,
            1,
            until.Day,
            false);
    }

    public async Task<AppResult<AttendanceMonthlyResult>> SaveMonthAsync(
        SaveAttendanceMonthCommand command,
        CancellationToken cancellationToken)
    {
        if (!IsValidMonth(command.Year, command.Month))
        {
            return AppResult<AttendanceMonthlyResult>.Failure("attendance.invalid_month", "Tháng chấm công không hợp lệ.");
        }

        var from = new DateOnly(command.Year, command.Month, 1);
        var until = from.AddMonths(1).AddDays(-1);
        var duplicateDays = command.Days.GroupBy(x => new { x.EmployeeId, x.WorkDate }).FirstOrDefault(x => x.Count() > 1);
        if (duplicateDays is not null)
        {
            return AppResult<AttendanceMonthlyResult>.Failure("attendance.duplicate_day", "Một ngày chấm công chỉ được xuất hiện một lần.");
        }

        var employeeIds = command.Days.Select(x => x.EmployeeId).Distinct().ToArray();
        var employees = await db.Employees.Where(x => employeeIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var scheduleContext = await LoadScheduleContextAsync(employeeIds, from, until, cancellationToken);
        var existingDays = await db.AttendanceDays
            .Include(x => x.Shifts)
            .Where(x => employeeIds.Contains(x.EmployeeId) && x.WorkDate >= from && x.WorkDate <= until)
            .ToListAsync(cancellationToken);
        var existingByKey = existingDays.ToDictionary(x => (x.EmployeeId, x.WorkDate));

        foreach (var inputDay in command.Days)
        {
            if (inputDay.WorkDate < from || inputDay.WorkDate > until)
            {
                return AppResult<AttendanceMonthlyResult>.Failure("attendance.invalid_date", "Ngày chấm công không thuộc tháng đã chọn.");
            }

            if (!employees.ContainsKey(inputDay.EmployeeId))
            {
                return AppResult<AttendanceMonthlyResult>.Failure("attendance.employee_not_found", "Không tìm thấy nhân viên.");
            }

            if (inputDay.OvertimeHours < 0 || inputDay.OvertimeHours > 24)
            {
                return AppResult<AttendanceMonthlyResult>.Failure("attendance.invalid_value", "Giờ TC phải nằm trong khoảng từ 0 đến 24.");
            }

            if (inputDay.Shifts.GroupBy(x => x.SlotNumber).Any(x => x.Count() > 1))
            {
                return AppResult<AttendanceMonthlyResult>.Failure("attendance.invalid_shift", "Công đoạn ca bị trùng.");
            }

            var key = (inputDay.EmployeeId, inputDay.WorkDate);
            if (!existingByKey.TryGetValue(key, out var day))
            {
                var snapshots = ResolveCurrentSlots(inputDay.EmployeeId, inputDay.WorkDate, scheduleContext);
                if (snapshots.Count == 0)
                {
                    return AppResult<AttendanceMonthlyResult>.Failure("attendance.shift_not_setup", "Nhân viên chưa được cấu hình ca cho ngày này.");
                }

                day = new AttendanceDay
                {
                    EmployeeId = inputDay.EmployeeId,
                    WorkDate = inputDay.WorkDate,
                    Shifts = snapshots.Select(ToEntity).ToList()
                };
                db.AttendanceDays.Add(day);
                existingByKey[key] = day;
            }

            day.OvertimeHours = inputDay.OvertimeHours;
            var inputs = inputDay.Shifts.ToDictionary(x => x.SlotNumber);
            foreach (var shift in day.Shifts)
            {
                var input = inputs.GetValueOrDefault(shift.SlotNumber);
                var validation = ApplyValue(shift, input);
                if (!validation.IsSuccess)
                {
                    return AppResult<AttendanceMonthlyResult>.Failure(validation.Error!.Code, validation.Error.Message);
                }
            }

            if (inputs.Keys.Any(slot => day.Shifts.All(x => x.SlotNumber != slot)))
            {
                return AppResult<AttendanceMonthlyResult>.Failure("attendance.invalid_shift", "Công đoạn ca không thuộc lịch của ngày này.");
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return AppResult<AttendanceMonthlyResult>.Success(await GetMonthAsync(
            new AttendanceMonthlyQuery(
                command.Year,
                command.Month,
                EmployeeLimit: Math.Max(employeeIds.Length, 1),
                EmployeeIds: employeeIds), cancellationToken));
    }

    private async Task<ShiftScheduleContext> LoadScheduleContextAsync(
        IReadOnlyCollection<Guid> employeeIds,
        DateOnly from,
        DateOnly until,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return new ShiftScheduleContext([], []);
        }

        var assignments = await db.EmployeeShiftAssignments.AsNoTracking()
            .Where(x => employeeIds.Contains(x.EmployeeId)
                && x.EffectiveFrom <= until
                && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .OrderByDescending(x => x.EffectiveFrom)
            .ToListAsync(cancellationToken);
        var templateIds = assignments.Select(x => x.ShiftTemplateId).Distinct().ToArray();
        var periods = await db.ShiftPeriods.AsNoTracking()
            .Where(x => templateIds.Contains(x.ShiftTemplateId))
            .OrderBy(x => x.ShiftTemplateId)
            .ThenBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);
        return new ShiftScheduleContext(assignments, periods);
    }

    private static List<AttendanceShiftDto> ResolveCurrentSlots(
        Guid employeeId,
        DateOnly workDate,
        ShiftScheduleContext context)
    {
        var assignment = context.Assignments
            .Where(x => x.EmployeeId == employeeId
                && x.EffectiveFrom <= workDate
                && (x.EffectiveTo == null || x.EffectiveTo >= workDate))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefault();
        if (assignment is null)
        {
            return [];
        }

        return context.Periods.Where(x => x.ShiftTemplateId == assignment.ShiftTemplateId)
            .OrderBy(x => x.SortOrder)
            .Select((period, index) => new AttendanceShiftDto(
            index + 1,
            period.Id,
            period.Name,
            period.StartTime,
            period.EndTime,
            (decimal)(period.EndTime - period.StartTime).TotalHours,
            AttendanceShiftValueKind.Empty,
            null)).ToList();
    }

    private sealed record ShiftScheduleContext(
        IReadOnlyList<EmployeeShiftAssignment> Assignments,
        IReadOnlyList<ShiftPeriod> Periods);

    private static AttendanceShiftDto ToDto(AttendanceShiftEntry shift) => new(
        shift.SlotNumber,
        shift.SourceShiftPeriodId,
        shift.ShiftName,
        shift.ScheduledStartTime,
        shift.ScheduledEndTime,
        shift.ScheduledHours,
        shift.ValueKind,
        shift.WorkedHours);

    private static AttendanceDayDto ToDayDto(AttendanceDay day) => new(
        day.WorkDate,
        true,
        day.Shifts.Count > 0,
        day.OvertimeHours,
        day.Shifts.OrderBy(x => x.SlotNumber).Select(ToDto).ToList());

    private static AttendanceShiftEntry ToEntity(AttendanceShiftDto shift) => new()
    {
        SlotNumber = shift.SlotNumber,
        SourceShiftPeriodId = shift.SourceShiftPeriodId,
        ShiftName = shift.ShiftName,
        ScheduledStartTime = shift.ScheduledStartTime,
        ScheduledEndTime = shift.ScheduledEndTime,
        ScheduledHours = shift.ScheduledHours,
        ValueKind = AttendanceShiftValueKind.Empty
    };

    private static AppResult ApplyValue(AttendanceShiftEntry shift, AttendanceShiftInput? input)
    {
        var kind = input?.Kind ?? AttendanceShiftValueKind.Empty;
        var workedHours = input?.WorkedHours;
        if (!Enum.IsDefined(kind))
        {
            return AppResult.Failure("attendance.invalid_shift", "Giá trị ca không hợp lệ.");
        }

        switch (kind)
        {
            case AttendanceShiftValueKind.Empty:
                workedHours = null;
                break;
            case AttendanceShiftValueKind.Hours:
                if (!workedHours.HasValue || workedHours.Value < 0 || workedHours.Value > shift.ScheduledHours)
                {
                    return AppResult.Failure("attendance.invalid_value", "Giờ HC phải nằm trong giới hạn của ca.");
                }
                break;
            case AttendanceShiftValueKind.PaidLeave:
            case AttendanceShiftValueKind.SickLeave:
                if (workedHours.HasValue)
                {
                    return AppResult.Failure("attendance.invalid_value", "Nghỉ P/Ô không được mang theo giờ làm.");
                }
                break;
        }

        shift.ValueKind = kind;
        shift.WorkedHours = workedHours;
        return AppResult.Success();
    }

    private static AttendanceTotalsDto CalculateTotals(IEnumerable<AttendanceDayDto> days)
    {
        var dayList = days.ToList();
        return new AttendanceTotalsDto(
            dayList.SelectMany(x => x.Shifts).Where(x => x.ValueKind == AttendanceShiftValueKind.Hours)
                .Sum(x => x.WorkedHours ?? 0m),
            dayList.Sum(x => x.OvertimeHours),
            dayList.SelectMany(x => x.Shifts).Where(x => x.ValueKind == AttendanceShiftValueKind.PaidLeave)
                .Sum(x => x.ScheduledHours),
            dayList.SelectMany(x => x.Shifts).Where(x => x.ValueKind == AttendanceShiftValueKind.SickLeave)
                .Sum(x => x.ScheduledHours));
    }

    private static void ValidateMonth(int year, int month)
    {
        if (!IsValidMonth(year, month))
        {
            throw new ArgumentOutOfRangeException(nameof(month), "Tháng chấm công không hợp lệ.");
        }
    }

    private static bool IsValidMonth(int year, int month) => year is >= 2000 and <= 2100 && month is >= 1 and <= 12;

    private static EmployeeCursor? ParseEmployeeCursor(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor)) return null;
        try
        {
            var normalized = cursor.Replace('-', '+').Replace('_', '/');
            normalized = normalized.PadRight(normalized.Length + (4 - normalized.Length % 4) % 4, '=');
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(normalized));
            var parsed = JsonSerializer.Deserialize<EmployeeCursor>(json);
            if (parsed is not null && !string.IsNullOrWhiteSpace(parsed.EmployeeCode)) return parsed;
        }
        catch (FormatException)
        {
            // Normalize all malformed cursors to the same API error below.
        }
        catch (JsonException)
        {
            // Normalize all malformed cursors to the same API error below.
        }

        throw new ArgumentException("Cursor nhân viên không hợp lệ.", nameof(cursor));
    }

    private static string EncodeEmployeeCursor(Employee employee)
    {
        var json = JsonSerializer.Serialize(new EmployeeCursor(employee.EmployeeCode, employee.Id));
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(json))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private sealed record EmployeeCursor(string EmployeeCode, Guid EmployeeId);

    private static int ValidateEmployeeLimit(int limit)
    {
        if (limit is < 1 or > 100)
        {
            throw new ArgumentOutOfRangeException(nameof(limit), "Số nhân viên mỗi lần tải phải từ 1 đến 100.");
        }
        return limit;
    }
}
