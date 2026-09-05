using German.Application.Common;
using German.Application.ProductionOrders;
using German.Domain.Auth;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionOrders;

[TestClass]
public sealed class ProductionExternalQuantityServiceTests
{
    [TestMethod]
    public async Task CreateListUpdateAndDelete_OnlyChangesExternalQuantity()
    {
        await using var db = CreateDb();
        var order = new ProductionOrder { Code = "0417", ProductName = "Túi", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "May", Unit = "cái", SortOrder = 1 };
        var entry = new ProductionEntry
        {
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EmployeeId = Guid.NewGuid(),
            WorkDate = new DateOnly(2026, 8, 22),
            EntryMode = ProductionEntryMode.Direct,
            HcQuantity = 10m,
            TcQuantity = 2m,
            TotalQuantity = 12m,
            SubmittedByUserId = Guid.NewGuid()
        };
        db.AddRange(order, operation, entry);
        await db.SaveChangesAsync();
        var service = new ProductionExternalQuantityService(db);
        var actor = new CurrentActor(Guid.NewGuid(), UserRole.Manager, null);

        var created = await service.CreateAsync(actor, new CreateProductionExternalQuantityCommand(
            order.Id, operation.Id, new DateOnly(2026, 8, 22), 500m, "  Xưởng A  ", "  Nhận hàng  "), CancellationToken.None);

        Assert.IsTrue(created.IsSuccess, created.Error?.Message);
        Assert.AreEqual("Xưởng A", created.Value!.SourceName);
        Assert.IsNotNull(created.Value.ExternalSourceId);
        Assert.AreEqual(1, await db.ProductionExternalSources.CountAsync());
        Assert.AreEqual("Nhận hàng", created.Value.Note);
        Assert.AreEqual(12m, await db.ProductionEntries.Select(x => x.TotalQuantity).SingleAsync());

        var listed = await service.ListAsync(order.Id, operation.Id, null, null, CancellationToken.None);
        Assert.IsTrue(listed.IsSuccess, listed.Error?.Message);
        Assert.AreEqual(1, listed.Value!.Count);

        var updated = await service.UpdateAsync(actor, created.Value.Id, new UpdateProductionExternalQuantityCommand(
            new DateOnly(2026, 8, 23), 700m, "Xưởng B", null), CancellationToken.None);
        Assert.IsTrue(updated.IsSuccess, updated.Error?.Message);
        Assert.AreEqual(700m, updated.Value!.Quantity);
        Assert.AreEqual("Xưởng B", updated.Value.SourceName);
        Assert.IsNull(updated.Value.SourceEmployeeId);
        Assert.AreNotEqual(created.Value.ExternalSourceId, updated.Value.ExternalSourceId);
        Assert.IsNull(updated.Value.Note);

        var deleted = await service.DeleteAsync(actor, created.Value.Id, CancellationToken.None);
        Assert.IsTrue(deleted.IsSuccess, deleted.Error?.Message);
        Assert.AreEqual(0, await db.Set<ProductionExternalQuantity>().CountAsync());
        Assert.AreEqual(1, await db.ProductionEntries.CountAsync());
    }

    [TestMethod]
    public async Task Create_RejectsNonPositiveQuantityAndMismatchedOperation()
    {
        await using var db = CreateDb();
        var order = new ProductionOrder { Code = "0417B", ProductName = "Túi", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
        var otherOrder = new ProductionOrder { Code = "0521", ProductName = "Túi khác", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = otherOrder.Id, OperationNumber = 9, Name = "May", Unit = "cái", SortOrder = 1 };
        db.AddRange(order, otherOrder, operation);
        await db.SaveChangesAsync();
        var service = new ProductionExternalQuantityService(db);
        var actor = new CurrentActor(Guid.NewGuid(), UserRole.Admin, null);

        var invalidQuantity = await service.CreateAsync(actor, new CreateProductionExternalQuantityCommand(
            order.Id, operation.Id, new DateOnly(2026, 8, 22), 0m, null, null), CancellationToken.None);
        Assert.IsFalse(invalidQuantity.IsSuccess);
        Assert.AreEqual("production_external_quantity.invalid_quantity", invalidQuantity.Error?.Code);

        var mismatch = await service.CreateAsync(actor, new CreateProductionExternalQuantityCommand(
            order.Id, operation.Id, new DateOnly(2026, 8, 22), 1m, null, null), CancellationToken.None);
        Assert.IsFalse(mismatch.IsSuccess);
        Assert.AreEqual("production_external_quantity.operation_mismatch", mismatch.Error?.Code);
    }

    [TestMethod]
    public async Task WorkerCannotCreateExternalQuantity()
    {
        await using var db = CreateDb();
        var order = new ProductionOrder { Code = "0417C", ProductName = "Túi", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "May", Unit = "cái", SortOrder = 1 };
        db.AddRange(order, operation);
        await db.SaveChangesAsync();

        var result = await new ProductionExternalQuantityService(db).CreateAsync(
            new CurrentActor(Guid.NewGuid(), UserRole.Worker, Guid.NewGuid()),
            new CreateProductionExternalQuantityCommand(order.Id, operation.Id, new DateOnly(2026, 8, 22), 1m, null, null),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_external_quantity.forbidden", result.Error?.Code);
    }

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);
}
