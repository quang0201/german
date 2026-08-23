using German.Application.Common;
using German.Application.Attendance;
using German.Application.ProductionEntries;
using German.Domain.Auth;
using German.Domain.Attendance;
using German.Domain.Employees;
using German.Domain.Production;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionEntryBatchDirectSuccessTests
{
    [TestMethod]
    public async Task CreatesAllSelectedOperationsAsDirect()
    {
        await using var db = new GermanDbContext(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var employee = new Employee { EmployeeCode = "E902", FullName = "Admin" };
        var order = new ProductionOrder { Code = "O902", ProductName = "SP", PlannedQuantity = 100m, Status = ProductionOrderStatus.InProduction };
        var operations = new[] { 4, 5, 6, 100 }.Select(number => new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = number, Name = $"CĐ{number}", Unit = "cái", SortOrder = number }).ToArray();
        db.AddRange(employee, order); db.ProductionOperations.AddRange(operations); await db.SaveChangesAsync();
        var quantities = new[] { (100m, 0m), (100m, 20m), (80m, 10m), (40m, 5m) };
        var items = operations.Select((operation, index) => new CreateProductionEntryBatchDirectItem(operation.Id, quantities[index].Item1, quantities[index].Item2, null)).ToArray();
        var command = new CreateProductionEntryBatchDirectCommand(new DateOnly(2026, 8, 27), employee.Id, order.Id, items);

        var result = await new ProductionEntryBatchDirectService(db).CreateAsync(new CurrentActor(Guid.NewGuid(), UserRole.Admin, employee.Id), command, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(4, result.Value!.CreatedCount);
        var entries = await db.ProductionEntries.ToListAsync();
        Assert.AreEqual(4, entries.Count);
        Assert.IsTrue(entries.All(entry => entry.EntryMode == ProductionEntryMode.Direct));
        Assert.AreEqual(355m, entries.Sum(entry => entry.TotalQuantity));
    }

    [TestMethod]
    public async Task CreatesAttendanceAndProductionTogetherWhenHoursAreSubmitted()
    {
        await using var db = new GermanDbContext(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var employee = new Employee { EmployeeCode = "E903", FullName = "Nhân viên" };
        var order = new ProductionOrder { Code = "O903", ProductName = "SP", PlannedQuantity = 100m, Status = ProductionOrderStatus.InProduction };
        var template = new ShiftTemplate { Name = "Ca chuẩn" };
        template.Periods.Add(new ShiftPeriod { Name = "Ca 1", SortOrder = 1, StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(11, 0) });
        template.Periods.Add(new ShiftPeriod { Name = "Ca 2", SortOrder = 2, StartTime = new TimeOnly(13, 0), EndTime = new TimeOnly(17, 0) });
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "CĐ4", Unit = "cái", SortOrder = 4 };
        db.AddRange(employee, order, template, new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = template.Id,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        }, operation);
        await db.SaveChangesAsync();

        var command = new CreateProductionEntryBatchDirectCommand(
            new DateOnly(2026, 8, 22), employee.Id, order.Id,
            [new CreateProductionEntryBatchDirectItem(operation.Id, 800m, 100m, null)],
            new AttendanceDayInput(
                employee.Id,
                new DateOnly(2026, 8, 22),
                1m,
                [
                    new AttendanceShiftInput(1, AttendanceShiftValueKind.Hours, 4m),
                    new AttendanceShiftInput(2, AttendanceShiftValueKind.Hours, 4m)
                ]));

        var result = await new ProductionEntryBatchDirectService(db).CreateAsync(
            new CurrentActor(Guid.NewGuid(), UserRole.Admin, employee.Id), command, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(1, await db.ProductionEntries.CountAsync());
        var day = await db.AttendanceDays.Include(item => item.Shifts).SingleAsync();
        Assert.AreEqual(1m, day.OvertimeHours);
        Assert.AreEqual(8m, day.Shifts.Sum(item => item.WorkedHours ?? 0m));
    }
}
