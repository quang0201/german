using German.Domain.Attendance;
using German.Domain.Employees;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Attendance;

[TestClass]
public sealed class AttendancePersistenceTests
{
    [TestMethod]
    public async Task AttendanceModel_EnforcesDailyAndSlotKeys_AndOrdersSlots()
    {
        await using var db = CreateDbContext();

        var employee = new Employee { EmployeeCode = "A001", FullName = "An" };
        var day = new AttendanceDay { EmployeeId = employee.Id, WorkDate = new DateOnly(2026, 8, 16) };
        db.AddRange(
            employee,
            day,
            new AttendanceShiftEntry
            {
                AttendanceDayId = day.Id,
                SlotNumber = 2,
                ShiftName = "Ca chiều",
                ScheduledStartTime = new TimeOnly(13, 0),
                ScheduledEndTime = new TimeOnly(17, 0),
                ScheduledHours = 4
            },
            new AttendanceShiftEntry
            {
                AttendanceDayId = day.Id,
                SlotNumber = 1,
                ShiftName = "Ca sáng",
                ScheduledStartTime = new TimeOnly(7, 0),
                ScheduledEndTime = new TimeOnly(11, 0),
                ScheduledHours = 4
            });
        await db.SaveChangesAsync();

        var slots = await db.AttendanceShiftEntries
            .Where(x => x.AttendanceDayId == day.Id)
            .OrderBy(x => x.SlotNumber)
            .ToListAsync();

        Assert.AreEqual(2, slots.Count);
        Assert.AreEqual(1, slots[0].SlotNumber);
        Assert.AreEqual(2, slots[1].SlotNumber);

        var dayIndexes = db.Model.FindEntityType(typeof(AttendanceDay))!.GetIndexes();
        Assert.IsTrue(dayIndexes.Any(x => x.IsUnique &&
            x.Properties.Select(property => property.Name).SequenceEqual([nameof(AttendanceDay.EmployeeId), nameof(AttendanceDay.WorkDate)])));

        var slotIndexes = db.Model.FindEntityType(typeof(AttendanceShiftEntry))!.GetIndexes();
        Assert.IsTrue(slotIndexes.Any(x => x.IsUnique &&
            x.Properties.Select(property => property.Name).SequenceEqual([nameof(AttendanceShiftEntry.AttendanceDayId), nameof(AttendanceShiftEntry.SlotNumber)])));

        var dayForeignKey = db.Model.FindEntityType(typeof(AttendanceShiftEntry))!.GetForeignKeys()
            .Single(x => x.PrincipalEntityType.ClrType == typeof(AttendanceDay));
        Assert.AreEqual(DeleteBehavior.Cascade, dayForeignKey.DeleteBehavior);
    }

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
