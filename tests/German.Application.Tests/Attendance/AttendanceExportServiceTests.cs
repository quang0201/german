using German.Application.Abstractions;
using German.Application.Attendance;
using German.Domain.Attendance;
using German.Domain.Employees;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Attendance;

[TestClass]
public sealed class AttendanceExportServiceTests
{
    [TestMethod]
    public async Task ExportAsync_UsesSavedDaysAndKeepsHistoricalEmployees()
    {
        await using var db = CreateDbContext();
        var active = new Employee { EmployeeCode = "A201", FullName = "Đang làm" };
        var inactive = new Employee { EmployeeCode = "A202", FullName = "Đã nghỉ", IsActive = false };
        var day = new AttendanceDay
        {
            EmployeeId = inactive.Id,
            WorkDate = new DateOnly(2026, 8, 1),
            OvertimeHours = 1m,
            Note = "Đã lưu"
        };
        day.Shifts.Add(new AttendanceShiftEntry
        {
            AttendanceDayId = day.Id,
            SlotNumber = 1,
            ScheduledHours = 4m,
            ValueKind = AttendanceShiftValueKind.Hours,
            WorkedHours = 4m
        });
        db.AddRange(active, inactive, day);
        await db.SaveChangesAsync();

        var exporter = new CapturingExporter();
        var bytes = await new AttendanceExportService(db, exporter).ExportAsync(2026, 8, CancellationToken.None);

        Assert.AreEqual(1, bytes.Length);
        CollectionAssert.AreEqual(new[] { "A201", "A202" }, exporter.Data!.Employees.Select(x => x.EmployeeCode).ToArray());
        Assert.AreEqual(0, exporter.Data.Employees[0].Days.Count);
        var historicalDay = exporter.Data.Employees[1].Days.Single();
        Assert.AreEqual(new DateOnly(2026, 8, 1), historicalDay.WorkDate);
        Assert.AreEqual(1m, historicalDay.OvertimeHours);
        Assert.AreEqual("Đã lưu", historicalDay.Note);
        Assert.AreEqual(AttendanceShiftValueKind.Hours, historicalDay.Shifts.Single().ValueKind);
        Assert.AreEqual(4m, exporter.Data.Employees[1].Totals.RegularWorkedHours);
    }

    private sealed class CapturingExporter : IAttendanceExcelExporter
    {
        public AttendanceExportData? Data { get; private set; }

        public byte[] Export(AttendanceExportData data)
        {
            Data = data;
            return [1];
        }
    }

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
