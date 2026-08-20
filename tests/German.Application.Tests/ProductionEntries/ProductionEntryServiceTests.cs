using German.Application.Common;
using German.Application.ProductionEntries;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionEntryServiceTests
{
    [TestMethod]
    public async Task Worker_CannotSubmitForAnotherEmployee()
    {
        await using var db = CreateDbContext();
        var workerEmployeeId = Guid.NewGuid();
        var otherEmployeeId = Guid.NewGuid();
        var service = new ProductionEntryService(db);
        var actor = new CurrentActor(Guid.NewGuid(), UserRole.Worker, workerEmployeeId);

        var result = await service.CreateAsync(actor, new CreateProductionEntryCommand(
            new DateOnly(2026, 8, 11), otherEmployeeId, Guid.NewGuid(), Guid.NewGuid(),
            ProductionEntryMode.Direct, DirectHcQuantity: 100m, DirectTcQuantity: 0m), CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.forbidden_employee", result.Error?.Code);
    }

    [TestMethod]
    public async Task ByShift_UsesEffectiveShiftHoursToSplitReportedTotal()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "E001", FullName = "Quỳnh" };
        var shift = new ShiftTemplate { Name = "Ca A" };
        shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 1", StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(11, 30), SortOrder = 1 });
        shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 2", StartTime = new TimeOnly(12, 30), EndTime = new TimeOnly(17, 0), SortOrder = 2 });
        var assignment = new EmployeeShiftAssignment { EmployeeId = employee.Id, ShiftTemplateId = shift.Id, EffectiveFrom = new DateOnly(2026, 8, 1) };
        var order = new ProductionOrder { Code = "0417", ProductName = "Túi", PlannedQuantity = 10000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 15, Name = "Viền hoàn thiện", Unit = "cái", SortOrder = 15 };

        db.AddRange(employee, shift, assignment, order, operation);
        await db.SaveChangesAsync();

        var service = new ProductionEntryService(db);
        var actor = new CurrentActor(Guid.NewGuid(), UserRole.Worker, employee.Id);
        var result = await service.CreateAsync(actor, new CreateProductionEntryCommand(
            new DateOnly(2026, 8, 11), employee.Id, order.Id, operation.Id,
            ProductionEntryMode.ByShift, Shift1Quantity: 310m, Shift2Quantity: 120m, OvertimeHours: 2m), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(352m, result.Value?.HcQuantity);
        Assert.AreEqual(78m, result.Value?.TcQuantity);
        Assert.AreEqual(430m, result.Value?.TotalQuantity);
        Assert.AreEqual(1, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task ByShift_UsesHcHoursSentByFormInsteadOfReResolvingShiftTemplate()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "E001B", FullName = "Quỳnh" };
        var shift = new ShiftTemplate { Name = "Ca A" };
        shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 1", StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(11, 30), SortOrder = 1 });
        shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 2", StartTime = new TimeOnly(12, 30), EndTime = new TimeOnly(17, 0), SortOrder = 2 });
        var assignment = new EmployeeShiftAssignment { EmployeeId = employee.Id, ShiftTemplateId = shift.Id, EffectiveFrom = new DateOnly(2026, 8, 1) };
        var order = new ProductionOrder { Code = "0417B", ProductName = "Túi", PlannedQuantity = 10000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 15, Name = "Viền hoàn thiện", Unit = "cái", SortOrder = 15 };
        db.AddRange(employee, shift, assignment, order, operation);
        await db.SaveChangesAsync();

        var result = await new ProductionEntryService(db).CreateAsync(
            new CurrentActor(Guid.NewGuid(), UserRole.Worker, employee.Id),
            new CreateProductionEntryCommand(
                new DateOnly(2026, 8, 11), employee.Id, order.Id, operation.Id,
                ProductionEntryMode.ByShift, Shift1Quantity: 310m, Shift2Quantity: 120m,
                OvertimeHours: 2m, HcHours: 8m), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(344m, result.Value?.HcQuantity);
        Assert.AreEqual(86m, result.Value?.TcQuantity);
    }

    [TestMethod]
    public async Task Worker_CannotSubmitToDraftOrder()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "E002", FullName = "Trang" };
        var order = new ProductionOrder { Code = "0521", ProductName = "Túi B", PlannedQuantity = 5000m, Status = ProductionOrderStatus.Draft };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 1, Name = "Cắt", Unit = "cái", SortOrder = 1 };
        db.AddRange(employee, order, operation);
        await db.SaveChangesAsync();

        var service = new ProductionEntryService(db);
        var actor = new CurrentActor(Guid.NewGuid(), UserRole.Worker, employee.Id);
        var result = await service.CreateAsync(actor, new CreateProductionEntryCommand(
            new DateOnly(2026, 8, 11), employee.Id, order.Id, operation.Id,
            ProductionEntryMode.Direct, DirectHcQuantity: 100m, DirectTcQuantity: 0m), CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.order_not_in_production", result.Error?.Code);
    }

    [TestMethod]
    public async Task Manager_UpdateAndDelete_CreateAuditLogs()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "E003", FullName = "Đào" };
        var order = new ProductionOrder { Code = "0601", ProductName = "Túi C", PlannedQuantity = 5000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 11, Name = "May dải khóa", Unit = "cái", SortOrder = 11 };
        var entry = new ProductionEntry
        {
            WorkDate = new DateOnly(2026, 8, 11), EmployeeId = employee.Id, ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id, EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 100m, DirectTcQuantity = 0m, HcQuantity = 100m, TcQuantity = 0m,
            TotalQuantity = 100m, SubmittedByUserId = Guid.NewGuid(), Version = 1
        };
        db.AddRange(employee, order, operation, entry);
        await db.SaveChangesAsync();

        var actor = new CurrentActor(Guid.NewGuid(), UserRole.Manager, employee.Id);
        var service = new ProductionEntryService(db);
        var updated = await service.UpdateAsync(actor, entry.Id, 1, new UpdateProductionEntryCommand(
            entry.WorkDate, employee.Id, order.Id, operation.Id, ProductionEntryMode.Direct,
            DirectHcQuantity: 120m, DirectTcQuantity: 10m), CancellationToken.None);

        Assert.IsTrue(updated.IsSuccess, updated.Error?.Message);
        Assert.AreEqual(2, updated.Value?.Version);
        Assert.AreEqual(130m, updated.Value?.TotalQuantity);

        var deleted = await service.DeleteAsync(actor, entry.Id, 2, CancellationToken.None);
        Assert.IsTrue(deleted.IsSuccess, deleted.Error?.Message);
        Assert.AreEqual(2, await db.AuditLogs.CountAsync());
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task Create_WithExpectedEmpty_RejectsExistingMatrixCell()
    {
        await using var db = CreateDbContext();
        var employee = new Employee { EmployeeCode = "E004", FullName = "Hạnh" };
        var order = new ProductionOrder { Code = "0701", ProductName = "Túi D", PlannedQuantity = 5000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "Cắt", Unit = "cái", SortOrder = 4 };
        db.AddRange(employee, order, operation, new ProductionEntry
        {
            WorkDate = new DateOnly(2026, 8, 27),
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 10m,
            DirectTcQuantity = 0m,
            HcQuantity = 10m,
            TcQuantity = 0m,
            TotalQuantity = 10m,
            SubmittedByUserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var result = await new ProductionEntryService(db).CreateAsync(
            new CurrentActor(Guid.NewGuid(), UserRole.Manager, employee.Id),
            new CreateProductionEntryCommand(
                new DateOnly(2026, 8, 27), employee.Id, order.Id, operation.Id,
                ProductionEntryMode.Direct, DirectHcQuantity: 20m, DirectTcQuantity: 0m,
                ExpectedEmpty: true),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.cell_conflict", result.Error?.Code);
        Assert.AreEqual(1, await db.ProductionEntries.CountAsync());
    }

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
