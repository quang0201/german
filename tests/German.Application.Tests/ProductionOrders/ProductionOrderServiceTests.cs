using German.Application.ProductionOrders;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionOrders;

[TestClass]
public sealed class ProductionOrderServiceTests
{
    [TestMethod]
    public async Task Create_RejectsNegativeFixedPrice()
    {
        await using var db = CreateDbContext();
        var service = new ProductionOrderService(db);

        var result = await service.CreateAsync(new CreateProductionOrderCommand(
            "SX-NEGATIVE", "Áo A", 100m, ProductionOrderStatus.Draft,
            null, null, null,
            [new ProductionOperationInput(10, "Cắt", "cái", 1, true, -1m)]), CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_operation.invalid_price", result.Error?.Code);
    }

    [TestMethod]
    public async Task Clone_PreservesFixedPrice()
    {
        await using var db = CreateDbContext();
        var source = new ProductionOrder { Code = "SX-SOURCE", ProductName = "Áo A", PlannedQuantity = 100m };
        source.Operations.Add(new ProductionOperation
        {
            ProductionOrderId = source.Id,
            OperationNumber = 10,
            Name = "Cắt",
            Unit = "cái",
            SortOrder = 1,
            FixedPrice = 25000.50m
        });
        db.ProductionOrders.Add(source);
        await db.SaveChangesAsync();

        var service = new ProductionOrderService(db);
        var result = await service.CreateAsync(new CreateProductionOrderCommand(
            "SX-CLONE", "Áo B", 200m, ProductionOrderStatus.Draft,
            null, null, source.Id, null), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(25000.50m, result.Value?.Operations.Single().FixedPrice);
    }

    [TestMethod]
    public async Task DeleteOperation_RemovesRelatedEntriesAndKeepsTheOrderAndOtherOperations()
    {
        await using var db = CreateDbContext();
        var order = new ProductionOrder { Code = "0417", ProductName = "Áo A", PlannedQuantity = 100m };
        var target = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 567, Name = "CĐ567", Unit = "cái", SortOrder = 567 };
        var other = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 10, Name = "Cắt", Unit = "cái", SortOrder = 10 };
        var targetEntry = new ProductionEntry { ProductionOrderId = order.Id, ProductionOperationId = target.Id, WorkDate = new DateOnly(2026, 8, 15), EmployeeId = Guid.NewGuid(), SubmittedByUserId = Guid.NewGuid() };
        var deletedTargetEntry = new ProductionEntry { ProductionOrderId = order.Id, ProductionOperationId = target.Id, WorkDate = new DateOnly(2026, 8, 16), EmployeeId = Guid.NewGuid(), SubmittedByUserId = Guid.NewGuid(), IsDeleted = true };
        var otherEntry = new ProductionEntry { ProductionOrderId = order.Id, ProductionOperationId = other.Id, WorkDate = new DateOnly(2026, 8, 15), EmployeeId = Guid.NewGuid(), SubmittedByUserId = Guid.NewGuid() };
        db.AddRange(order, target, other, targetEntry, deletedTargetEntry, otherEntry);
        await db.SaveChangesAsync();

        var service = new ProductionOrderService(db);
        var result = await service.DeleteOperationAsync(order.Id, target.Id, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.IsNotNull(await db.ProductionOrders.FindAsync(order.Id));
        Assert.IsNull(await db.ProductionOperations.FindAsync(target.Id));
        Assert.IsNotNull(await db.ProductionOperations.FindAsync(other.Id));
        Assert.AreEqual(0, await db.ProductionEntries.IgnoreQueryFilters().CountAsync(x => x.ProductionOperationId == target.Id));
        Assert.AreEqual(1, await db.ProductionEntries.IgnoreQueryFilters().CountAsync(x => x.ProductionOperationId == other.Id));
    }

    private static GermanDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
