using German.Application.Attendance;
using German.Domain.Attendance;
using German.Domain.Employees;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Attendance;

[TestClass]
public sealed class AttendanceServiceTests
{
    [TestMethod]
    public async Task GetMonth_UsesAssignmentEffectiveForEachDay_AndDynamicSlotOrder()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A100", FullName = "An" };
        var first = CreateShift("Ca A", ("Sáng", 2, 7, 11), ("Chiều", 1, 13, 17));
        var second = CreateShift("Ca B", ("Đêm", 3, 18, 22));
        db.AddRange(employee, first, second,
            new EmployeeShiftAssignment
            {
                EmployeeId = employee.Id,
                ShiftTemplateId = first.Id,
                EffectiveFrom = new DateOnly(2026, 8, 1),
                EffectiveTo = new DateOnly(2026, 8, 15)
            },
            new EmployeeShiftAssignment
            {
                EmployeeId = employee.Id,
                ShiftTemplateId = second.Id,
                EffectiveFrom = new DateOnly(2026, 8, 16)
            });
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(2026, 8, employee.Id, DayFrom: 15, DayCount: 2), CancellationToken.None);

        var days = result.Employees.Single().Days;
        Assert.AreEqual("Chiều", days.Single(x => x.WorkDate.Day == 15).Shifts[0].ShiftName);
        Assert.AreEqual("Đêm", days.Single(x => x.WorkDate.Day == 16).Shifts[0].ShiftName);
        CollectionAssert.AreEqual(new[] { 1, 2 }, days.Single(x => x.WorkDate.Day == 15)
            .Shifts.Select(x => x.SlotNumber).ToArray());
    }

    [TestMethod]
    public async Task GetMonth_WithoutEffectiveAssignment_ReturnsNonEditableDay()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A101", FullName = "Bình" };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(2026, 8, employee.Id), CancellationToken.None);

        var day = result.Employees.Single().Days.Single(x => x.WorkDate.Day == 1);
        Assert.IsFalse(day.HasShiftSetup);
        Assert.AreEqual(0, day.Shifts.Count);
    }

    [TestMethod]
    public async Task SaveMonth_StoresHoursLeaveAndDailyOvertime_AndReturnsTotals()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A102", FullName = "Chi" };
        var shift = CreateShift("Ca chuẩn", ("Ca 1", 1, 7, 11), ("Ca 2", 2, 13, 17), ("Ca 3", 3, 18, 20));
        db.AddRange(employee, shift, new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = shift.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        });
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026,
            8,
            [new AttendanceDayInput(
                employee.Id,
                new DateOnly(2026, 8, 16),
                2m,
                [
                    new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 4m),
                    new AttendanceShiftInput(2, AttendanceShiftValueKind.PaidLeave, null),
                    new AttendanceShiftInput(3, AttendanceShiftValueKind.SickLeave, null)
                ])]), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        var day = result.Value!.Employees.Single().Days.Single(x => x.WorkDate.Day == 16);
        Assert.AreEqual(4m, day.Shifts[0].WorkedHours);
        Assert.AreEqual(AttendanceShiftValueKind.PaidLeave, day.Shifts[1].ValueKind);
        Assert.AreEqual(2m, day.OvertimeHours);
        Assert.AreEqual(4m, result.Value.Employees.Single().Totals.RegularWorkedHours);
        Assert.AreEqual(2m, result.Value.Employees.Single().Totals.OvertimeHours);
        Assert.AreEqual(4m, result.Value.Employees.Single().Totals.PaidLeaveHours);
        Assert.AreEqual(2m, result.Value.Employees.Single().Totals.SickLeaveHours);
    }

    [TestMethod]
    public async Task SaveMonth_RejectsHoursAboveScheduledAndOvertimeAbove24()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A103", FullName = "Dũng" };
        var shift = CreateShift("Ca", ("Ca 1", 1, 7, 11));
        db.AddRange(employee, shift, new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = shift.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        });
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026,
            8,
            [new AttendanceDayInput(employee.Id, new DateOnly(2026, 8, 1), 25m,
                [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 5m)])]), CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("attendance.invalid_value", result.Error?.Code);
    }

    [TestMethod]
    public async Task SaveMonth_KeepsExistingSnapshotWhenShiftTemplateChanges()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A104", FullName = "Em" };
        var shift = CreateShift("Ca cũ", ("Ca cũ", 1, 7, 11));
        db.AddRange(employee, shift, new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = shift.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        });
        await db.SaveChangesAsync();
        var service = new AttendanceService(db);

        var first = await service.SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026, 8, [new AttendanceDayInput(employee.Id, new DateOnly(2026, 8, 10), 0,
                [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 3)])]), CancellationToken.None);
        Assert.IsTrue(first.IsSuccess, first.Error?.Message);

        shift.Name = "Ca mới";
        var period = await db.ShiftPeriods.SingleAsync(x => x.ShiftTemplateId == shift.Id);
        period.Name = "Ca mới";
        period.EndTime = new TimeOnly(12, 0);
        await db.SaveChangesAsync();

        var second = await service.SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026, 8, [new AttendanceDayInput(employee.Id, new DateOnly(2026, 8, 10), 0,
                [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 4)])]), CancellationToken.None);

        Assert.IsTrue(second.IsSuccess, second.Error?.Message);
        var saved = second.Value!.Employees.Single().Days.Single(x => x.WorkDate.Day == 10).Shifts.Single();
        Assert.AreEqual("Ca cũ", saved.ShiftName);
        Assert.AreEqual(4, saved.ScheduledHours);
    }

    [TestMethod]
    public async Task GetMonth_IncludesInactiveEmployeeWhenAttendanceExistsInRequestedMonth()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A105", FullName = "Nghỉ việc", IsActive = false };
        var day = new AttendanceDay { EmployeeId = employee.Id, WorkDate = new DateOnly(2026, 8, 17), OvertimeHours = 1m };
        day.Shifts.Add(new AttendanceShiftEntry
        {
            AttendanceDayId = day.Id,
            SlotNumber = 1,
            ShiftName = "Ca lịch sử",
            ScheduledStartTime = new TimeOnly(7, 0),
            ScheduledEndTime = new TimeOnly(11, 0),
            ScheduledHours = 4m,
            ValueKind = AttendanceShiftValueKind.Hours,
            WorkedHours = 4m
        });
        db.AddRange(employee, day);
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(2026, 8, DayFrom: 17, DayCount: 1), CancellationToken.None);

        var historical = result.Employees.Single(x => x.EmployeeId == employee.Id);
        Assert.AreEqual("Nghỉ việc", historical.FullName);
        Assert.IsTrue(historical.Days.Single(x => x.WorkDate.Day == 17).HasAttendance);
    }

    [TestMethod]
    public async Task GetMonth_DoesNotCreateEditableSlotsForUnsavedDaysOfInactiveEmployee()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A105B", FullName = "Đã nghỉ", IsActive = false };
        var shift = CreateShift("Ca lịch sử", ("Ca 1", 1, 7, 11));
        var day = new AttendanceDay { EmployeeId = employee.Id, WorkDate = new DateOnly(2026, 8, 17) };
        day.Shifts.Add(new AttendanceShiftEntry
        {
            AttendanceDayId = day.Id,
            SlotNumber = 1,
            ShiftName = "Ca 1",
            ScheduledStartTime = new TimeOnly(7, 0),
            ScheduledEndTime = new TimeOnly(11, 0),
            ScheduledHours = 4m,
            ValueKind = AttendanceShiftValueKind.Hours,
            WorkedHours = 4m
        });
        db.AddRange(employee, shift, day, new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = shift.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        });
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(2026, 8, employee.Id, DayFrom: 17, DayCount: 2), CancellationToken.None);

        var days = result.Employees.Single().Days;
        Assert.IsTrue(days.Single(x => x.WorkDate.Day == 17).HasAttendance);
        Assert.IsFalse(days.Single(x => x.WorkDate.Day == 18).HasShiftSetup);
        Assert.AreEqual(0, days.Single(x => x.WorkDate.Day == 18).Shifts.Count);
    }

    [TestMethod]
    public async Task GetMonth_IncludesEmployeeDeactivatedDuringRequestedMonthWithoutAttendance()
    {
        await using var db = CreateDbContext();
        var employee = new Employee
        {
            EmployeeCode = "A105D",
            FullName = "Tắt giữa tháng",
            IsActive = false,
            DeactivatedAt = new DateOnly(2026, 8, 15)
        };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(2026, 8, DayFrom: 15, DayCount: 1), CancellationToken.None);

        Assert.AreEqual(employee.Id, result.Employees.Single().EmployeeId);
        Assert.IsFalse(result.Employees.Single().Days.Single().HasShiftSetup);
    }

    [TestMethod]
    public async Task GetMonth_HidesInactiveEmployeeAfterDeactivationMonthWithoutHistory()
    {
        await using var db = CreateDbContext();
        var employee = new Employee
        {
            EmployeeCode = "A105E",
            FullName = "Ẩn tháng sau",
            IsActive = false,
            DeactivatedAt = new DateOnly(2026, 8, 15)
        };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(2026, 9), CancellationToken.None);

        Assert.AreEqual(0, result.Employees.Count);
    }

    [TestMethod]
    public async Task SaveMonth_AllowsEditingExistingInactiveDayButRejectsNewDay()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A105C", FullName = "Đã nghỉ", IsActive = false };
        var day = new AttendanceDay { EmployeeId = employee.Id, WorkDate = new DateOnly(2026, 8, 17) };
        day.Shifts.Add(new AttendanceShiftEntry
        {
            AttendanceDayId = day.Id,
            SlotNumber = 1,
            ShiftName = "Ca lịch sử",
            ScheduledStartTime = new TimeOnly(7, 0),
            ScheduledEndTime = new TimeOnly(11, 0),
            ScheduledHours = 4m,
            ValueKind = AttendanceShiftValueKind.Empty
        });
        db.AddRange(employee, day);
        await db.SaveChangesAsync();
        var service = new AttendanceService(db);

        var edit = await service.SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026, 8, [new AttendanceDayInput(employee.Id, new DateOnly(2026, 8, 17), 0m,
                [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 3m)])]), CancellationToken.None);

        Assert.IsTrue(edit.IsSuccess, edit.Error?.Message);
        Assert.AreEqual(3m, (await db.AttendanceDays.Include(x => x.Shifts).SingleAsync()).Shifts.Single().WorkedHours);

        var create = await service.SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026, 8, [new AttendanceDayInput(employee.Id, new DateOnly(2026, 8, 18), 0m, [])]), CancellationToken.None);

        Assert.IsFalse(create.IsSuccess);
        Assert.AreEqual("attendance.inactive_employee", create.Error?.Code);
        Assert.AreEqual(1, await db.AttendanceDays.CountAsync());
    }

    [TestMethod]
    public async Task SaveMonth_PersistsOnlySubmittedDays()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A106", FullName = "Chỉ một ngày" };
        var shift = CreateShift("Ca", ("Ca 1", 1, 7, 11));
        db.AddRange(employee, shift, new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = shift.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        });
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026,
            8,
            [new AttendanceDayInput(employee.Id, new DateOnly(2026, 8, 16), 0m,
                [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 4m)])]), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(1, await db.AttendanceDays.CountAsync());
        var nextDay = await new AttendanceHoursQueryService(db).GetAsync(
            employee.Id, new DateOnly(2026, 8, 17), CancellationToken.None);
        Assert.IsFalse(nextDay.HasAttendance);
    }

    [TestMethod]
    public async Task GetMonth_PaginatesEmployeesWithCursorAndLimit()
    {
        await using var db = CreateDbContext();
        db.Employees.AddRange(
            new Employee { EmployeeCode = "A201", FullName = "Một" },
            new Employee { EmployeeCode = "A202", FullName = "Hai" },
            new Employee { EmployeeCode = "A203", FullName = "Ba" });
        await db.SaveChangesAsync();
        var service = new AttendanceService(db);

        var first = await service.GetMonthAsync(new AttendanceMonthlyQuery(2026, 8, EmployeeLimit: 2), CancellationToken.None);
        var second = await service.GetMonthAsync(new AttendanceMonthlyQuery(2026, 8, EmployeeCursor: first.NextEmployeeCursor, EmployeeLimit: 2), CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "A201", "A202" }, first.Employees.Select(x => x.EmployeeCode).ToArray());
        Assert.IsTrue(first.HasMoreEmployees);
        Assert.IsFalse(string.IsNullOrWhiteSpace(first.NextEmployeeCursor));
        CollectionAssert.AreEqual(new[] { "A203" }, second.Employees.Select(x => x.EmployeeCode).ToArray());
        Assert.IsFalse(second.HasMoreEmployees);
        Assert.AreEqual(1, second.DayFrom);
        Assert.AreEqual(7, second.DayTo);
        Assert.IsTrue(second.HasMoreDays);
    }

    [TestMethod]
    public async Task GetMonth_LoadsOnlyRequestedDayWindowButKeepsFullMonthTotals()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A204", FullName = "Ngoài block" };
        var day = new AttendanceDay { EmployeeId = employee.Id, WorkDate = new DateOnly(2026, 8, 31) };
        day.Shifts.Add(new AttendanceShiftEntry
        {
            AttendanceDayId = day.Id,
            SlotNumber = 1,
            ShiftName = "Ca lịch sử",
            ScheduledStartTime = new TimeOnly(7, 0),
            ScheduledEndTime = new TimeOnly(11, 0),
            ScheduledHours = 4m,
            ValueKind = AttendanceShiftValueKind.Hours,
            WorkedHours = 4m
        });
        db.AddRange(employee, day);
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(2026, 8, DayFrom: 1, DayCount: 10), CancellationToken.None);

        var loaded = result.Employees.Single();
        Assert.AreEqual(10, loaded.Days.Count);
        Assert.AreEqual(1, loaded.Days[0].WorkDate.Day);
        Assert.AreEqual(10, loaded.Days[^1].WorkDate.Day);
        Assert.AreEqual(4m, loaded.Totals.RegularWorkedHours);
        Assert.AreEqual(11, result.NextDayFrom);
        Assert.IsTrue(result.HasMoreDays);
    }

    [DataTestMethod]
    [DataRow(2026, 2, 28)]
    [DataRow(2028, 2, 29)]
    [DataRow(2026, 4, 30)]
    [DataRow(2026, 8, 31)]
    public async Task GetMonth_FinalDayBlockMatchesMonthLength(int year, int month, int lastDay)
    {
        await using var db = CreateDbContext();
        db.Employees.Add(new Employee { EmployeeCode = $"A{month}{lastDay}", FullName = "Block cuối" });
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).GetMonthAsync(
            new AttendanceMonthlyQuery(year, month, DayFrom: 21, DayCount: lastDay - 20), CancellationToken.None);

        Assert.AreEqual(lastDay - 20, result.Employees.Single().Days.Count);
        Assert.AreEqual(21, result.DayFrom);
        Assert.AreEqual(lastDay, result.DayTo);
        Assert.IsNull(result.NextDayFrom);
        Assert.IsFalse(result.HasMoreDays);
    }

    [TestMethod]
    public async Task SaveMonth_ReturnsAllSubmittedEmployeesWhenMoreThanPageLimit()
    {
        await using var db = CreateDbContext();
        var employees = Enumerable.Range(1, 101)
            .Select(index => new Employee { EmployeeCode = $"A{index:000}", FullName = $"Nhân viên {index}" })
            .ToArray();
        var shift = CreateShift("Ca chung", ("Ca 1", 1, 7, 11));
        db.Employees.AddRange(employees);
        db.ShiftTemplates.Add(shift);
        db.EmployeeShiftAssignments.AddRange(employees.Select(employee => new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = shift.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        }));
        await db.SaveChangesAsync();

        var result = await new AttendanceService(db).SaveMonthAsync(new SaveAttendanceMonthCommand(
            2026,
            8,
            employees.Select(employee => new AttendanceDayInput(
                employee.Id,
                new DateOnly(2026, 8, 1),
                0m,
                [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 4m)])).ToArray()),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(101, result.Value!.Employees.Count);
        Assert.AreEqual(101, await db.AttendanceDays.CountAsync());
    }

    [TestMethod]
    public async Task SaveMonth_ReturnsOnlySubmittedEmployeeDatePairs()
    {
        await using var db = CreateDbContext();
        var employees = new[]
        {
            new Employee { EmployeeCode = "A107", FullName = "Một" },
            new Employee { EmployeeCode = "A108", FullName = "Hai" }
        };
        var shift = CreateShift("Ca", ("Ca 1", 1, 7, 11));
        db.Employees.AddRange(employees);
        db.ShiftTemplates.Add(shift);
        db.EmployeeShiftAssignments.AddRange(employees.Select(employee => new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = shift.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        }));
        await db.SaveChangesAsync();
        var service = new AttendanceService(db);

        var allDays = new[]
        {
            new AttendanceDayInput(employees[0].Id, new DateOnly(2026, 8, 1), 0m, [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 1m)]),
            new AttendanceDayInput(employees[0].Id, new DateOnly(2026, 8, 2), 0m, [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 1m)]),
            new AttendanceDayInput(employees[1].Id, new DateOnly(2026, 8, 1), 0m, [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 1m)]),
            new AttendanceDayInput(employees[1].Id, new DateOnly(2026, 8, 2), 0m, [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 1m)])
        };
        var initial = await service.SaveMonthAsync(new SaveAttendanceMonthCommand(2026, 8, allDays), CancellationToken.None);
        Assert.IsTrue(initial.IsSuccess, initial.Error?.Message);

        var result = await service.SaveMonthAsync(new SaveAttendanceMonthCommand(2026, 8, [
            allDays[0] with { Shifts = [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 2m)] },
            allDays[3] with { Shifts = [new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 2m)] }
        ]), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(1, result.Value!.Employees.Single(employee => employee.EmployeeId == employees[0].Id).Days.Count);
        Assert.AreEqual(new DateOnly(2026, 8, 1), result.Value.Employees.Single(employee => employee.EmployeeId == employees[0].Id).Days.Single().WorkDate);
        Assert.AreEqual(1, result.Value.Employees.Single(employee => employee.EmployeeId == employees[1].Id).Days.Count);
        Assert.AreEqual(new DateOnly(2026, 8, 2), result.Value.Employees.Single(employee => employee.EmployeeId == employees[1].Id).Days.Single().WorkDate);
    }

    private static ShiftTemplate CreateShift(string name, params (string Name, int SortOrder, int Start, int End)[] periods)
    {
        var shift = new ShiftTemplate { Name = name };
        foreach (var period in periods)
        {
            shift.Periods.Add(new ShiftPeriod
            {
                ShiftTemplateId = shift.Id,
                Name = period.Name,
                StartTime = new TimeOnly(period.Start, 0),
                EndTime = new TimeOnly(period.End, 0),
                SortOrder = period.SortOrder
            });
        }
        return shift;
    }

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
