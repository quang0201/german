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

    private static GermanDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
