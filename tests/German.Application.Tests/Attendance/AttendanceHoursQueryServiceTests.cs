using German.Application.Attendance;
using German.Domain.Attendance;
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

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
