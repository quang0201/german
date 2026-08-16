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
            new AttendanceMonthlyQuery(2026, 8, employee.Id), CancellationToken.None);

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
