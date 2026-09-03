using German.Application.Attendance;
using German.Domain.Attendance;
using German.Domain.Employees;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Attendance;

[TestClass]
public sealed class AttendanceHoursQueryServiceTests
{
    [TestMethod]
    public async Task Get_ReturnsWorkedLeaveAndOvertimeHours()
    {
        await using var db = CreateDbContext();
        var employeeId = Guid.NewGuid();
        var day = new AttendanceDay { EmployeeId = employeeId, WorkDate = new DateOnly(2026, 8, 16), OvertimeHours = 2m };
        day.Shifts.Add(new AttendanceShiftEntry
        {
            AttendanceDayId = day.Id,
            SlotNumber = 1,
            ShiftName = "Ca 1",
            ScheduledHours = 4m,
            ValueKind = AttendanceShiftValueKind.Hours,
            WorkedHours = 3m
        });
        day.Shifts.Add(new AttendanceShiftEntry
        {
            AttendanceDayId = day.Id,
            SlotNumber = 2,
            ShiftName = "Ca 2",
            ScheduledHours = 4m,
            ValueKind = AttendanceShiftValueKind.PaidLeave
        });
        db.AttendanceDays.Add(day);
        await db.SaveChangesAsync();

        var result = await new AttendanceHoursQueryService(db).GetAsync(
            employeeId, new DateOnly(2026, 8, 16), CancellationToken.None);

        Assert.IsTrue(result.HasAttendance);
        Assert.AreEqual(3m, result.RegularHours);
        Assert.AreEqual(2m, result.OvertimeHours);
        Assert.AreEqual(4m, result.PaidLeaveHours);
        Assert.AreEqual(0m, result.SickLeaveHours);
    }

    [TestMethod]
    public async Task Get_WithoutSavedAttendance_DoesNotInferHours()
    {
        await using var db = CreateDbContext();
        var employeeId = Guid.NewGuid();

        var result = await new AttendanceHoursQueryService(db).GetAsync(
            employeeId, new DateOnly(2026, 8, 16), CancellationToken.None);

        Assert.IsFalse(result.HasAttendance);
        Assert.AreEqual(0m, result.RegularHours);
        Assert.AreEqual(0m, result.OvertimeHours);
    }

    [TestMethod]
    public async Task Get_WithoutSavedAttendance_ReturnsConfiguredShiftInputs()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "A200", FullName = "Nhân viên" };
        var template = new ShiftTemplate { Name = "Ca chuẩn" };
        template.Periods.Add(new ShiftPeriod { Name = "Ca 1", SortOrder = 1, StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(11, 0) });
        template.Periods.Add(new ShiftPeriod { Name = "Ca 2", SortOrder = 2, StartTime = new TimeOnly(13, 0), EndTime = new TimeOnly(17, 0) });
        db.AddRange(employee, template, new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = template.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        });
        await db.SaveChangesAsync();

        var result = await new AttendanceHoursQueryService(db).GetAsync(
            employee.Id, new DateOnly(2026, 8, 22), CancellationToken.None);

        Assert.IsFalse(result.HasAttendance);
        CollectionAssert.AreEqual(new[] { "Ca 1", "Ca 2" }, result.Shifts.Select(item => item.ShiftName).ToArray());
        CollectionAssert.AreEqual(new[] { 0m, 0m }, result.Shifts.Select(item => item.WorkedHours).ToArray());
    }

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
