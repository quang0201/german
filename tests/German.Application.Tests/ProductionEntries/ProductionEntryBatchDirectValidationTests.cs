using German.Application.Common;
using German.Application.ProductionEntries;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionEntryBatchDirectValidationTests
{
    [TestMethod]
    public async Task EmptyBatchIsRejectedWithoutCreatingRows()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E910", FullName = "Manager" };
        var order = NewOrder("O910");
        db.AddRange(employee, order);
        await db.SaveChangesAsync();

        var result = await Service(db).CreateAsync(
            Actor(employee.Id),
            new CreateProductionEntryBatchDirectCommand(new DateOnly(2026, 8, 27), employee.Id, order.Id, Array.Empty<CreateProductionEntryBatchDirectItem>()),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.batch_empty", result.Error?.Code);
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task DuplicateOperationIdsAreRejectedWithoutCreatingRows()
    {
        await using var db = CreateDb();
        var (employee, order, operation) = await SeedAsync(db, "E911", "O911");
        var item = new CreateProductionEntryBatchDirectItem(operation.Id, 10m, 0m, null);

        var result = await Service(db).CreateAsync(
            Actor(employee.Id),
            new CreateProductionEntryBatchDirectCommand(new DateOnly(2026, 8, 27), employee.Id, order.Id, new[] { item, item }),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.batch_duplicate_operation", result.Error?.Code);
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task OperationFromAnotherOrderIsRejectedWithoutCreatingRows()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E912", FullName = "Manager" };
        var order = NewOrder("O912");
        var otherOrder = NewOrder("O913");
        var operation = NewOperation(otherOrder.Id, 4);
        db.AddRange(employee, order, otherOrder, operation);
        await db.SaveChangesAsync();

        var result = await Service(db).CreateAsync(
            Actor(employee.Id),
            Command(employee.Id, order.Id, operation.Id, 10m, 0m),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.operation_mismatch", result.Error?.Code);
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task NonProductionOrderIsRejectedServerSide()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E914", FullName = "Manager" };
        var order = NewOrder("O914", ProductionOrderStatus.Completed);
        var operation = NewOperation(order.Id, 4);
        db.AddRange(employee, order, operation);
        await db.SaveChangesAsync();

        var result = await Service(db).CreateAsync(
            Actor(employee.Id),
            Command(employee.Id, order.Id, operation.Id, 10m, 0m),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.order_not_in_production", result.Error?.Code);
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task InactiveOperationIsRejectedServerSide()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E915", FullName = "Manager" };
        var order = NewOrder("O915");
        var operation = NewOperation(order.Id, 4);
        operation.IsActive = false;
        db.AddRange(employee, order, operation);
        await db.SaveChangesAsync();

        var result = await Service(db).CreateAsync(
            Actor(employee.Id),
            Command(employee.Id, order.Id, operation.Id, 10m, 0m),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.operation_inactive", result.Error?.Code);
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task InvalidDirectQuantityUsesCalculatorValidationAndCreatesNothing()
    {
        await using var db = CreateDb();
        var (employee, order, operation) = await SeedAsync(db, "E916", "O916");

        var result = await Service(db).CreateAsync(
            Actor(employee.Id),
            Command(employee.Id, order.Id, operation.Id, -1m, 0m),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.invalid_input", result.Error?.Code);
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    private static ProductionEntryBatchDirectService Service(GermanDbContext db) => new(db);
    private static CurrentActor Actor(Guid employeeId) => new(Guid.NewGuid(), UserRole.Manager, employeeId);

    private static CreateProductionEntryBatchDirectCommand Command(Guid employeeId, Guid orderId, Guid operationId, decimal? hc, decimal? tc) =>
        new(new DateOnly(2026, 8, 27), employeeId, orderId, new[] { new CreateProductionEntryBatchDirectItem(operationId, hc, tc, null) });

    private static async Task<(Employee Employee, ProductionOrder Order, ProductionOperation Operation)> SeedAsync(GermanDbContext db, string employeeCode, string orderCode)
    {
        var employee = new Employee { EmployeeCode = employeeCode, FullName = "Manager" };
        var order = NewOrder(orderCode);
        var operation = NewOperation(order.Id, 4);
        db.AddRange(employee, order, operation);
        await db.SaveChangesAsync();
        return (employee, order, operation);
    }

    private static ProductionOrder NewOrder(string code, ProductionOrderStatus status = ProductionOrderStatus.InProduction) =>
        new() { Code = code, ProductName = "SP", PlannedQuantity = 100m, Status = status };

    private static ProductionOperation NewOperation(Guid orderId, int number) =>
        new() { ProductionOrderId = orderId, OperationNumber = number, Name = $"CĐ{number}", Unit = "cái", SortOrder = number };

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
