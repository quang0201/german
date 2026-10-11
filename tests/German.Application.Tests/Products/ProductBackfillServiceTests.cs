using German.Application.Products;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Products;

[TestClass]
public sealed class ProductBackfillServiceTests
{
    [DataTestMethod]
    [DataRow("4004 xanh", "4004")]
    [DataRow("TÚI 4004 đỏ", "4004")]
    [DataRow("4004 ... 3000", "4004")]
    [DataRow("0417", "0417")]
    [DataRow("Mã 12 và 4004", "4004")]
    [DataRow("A4004", "A4004")]
    [DataRow("  ab1  ", "AB1")]
    public void BaseOf_TakesFirstStandaloneNumberOfThreeOrMoreDigits(string code, string expected)
    {
        Assert.AreEqual(expected, ProductCodeKey.BaseOf(code));
    }

    [TestMethod]
    public async Task Plan_GroupsSameBaseAndSignature_AndSkipsTheRest_WithoutWriting()
    {
        await using var db = CreateDb();
        await SeedSampleAsync(db);

        var plan = await new ProductBackfillService(db).PlanAsync(CancellationToken.None);

        var product = plan.Products.Single();
        Assert.AreEqual("4004", product.Code);
        CollectionAssert.AreEquivalent(new[] { "4004 xanh", "4004 đen" }, product.Orders.Select(x => x.Code).ToArray());
        Assert.AreEqual("Túi 4004", product.Name, "Name is the shortest product name of the group.");
        CollectionAssert.AreEqual(new[] { 1, 2, 5 }, product.Operations.Select(x => x.OperationNumber).ToArray());
        var skipped = plan.Skipped.Single(x => x.Code == "TÚI 4004 đỏ");
        StringAssert.Contains(skipped.Reason, "khác");
        Assert.IsTrue(plan.Skipped.Any(x => x.Code == "0417"));
        Assert.AreEqual(0, await db.Products.CountAsync(), "A plan must not write anything.");
    }

    [TestMethod]
    public async Task Apply_CreatesProductAndLinksOrders_AndIsIdempotent()
    {
        await using var db = CreateDb();
        await SeedSampleAsync(db);
        var service = new ProductBackfillService(db);

        var first = await service.ApplyAsync(await service.PlanAsync(CancellationToken.None), CancellationToken.None);
        var second = await service.ApplyAsync(await service.PlanAsync(CancellationToken.None), CancellationToken.None);

        Assert.AreEqual(2, first);
        Assert.AreEqual(0, second);
        Assert.AreEqual(1, await db.Products.CountAsync());
        Assert.AreEqual(3, await db.ProductOperationTemplates.CountAsync());
        Assert.AreEqual(2, await db.ProductionOrders.CountAsync(x => x.ProductId != null));
        Assert.IsNull((await db.ProductionOrders.SingleAsync(x => x.Code == "TÚI 4004 đỏ")).ProductId);
    }

    [TestMethod]
    public async Task Plan_ReportsPriceDifferences_ButStillGroups()
    {
        await using var db = CreateDb();
        AddOrder(db, "4004 xanh", "Túi 4004 xanh", (1, "Cắt", 1000m), (2, "May", null));
        AddOrder(db, "4004 đen", "Túi 4004 đen", (1, "Cắt", 1100m), (2, "May", null));
        await db.SaveChangesAsync();

        var plan = await new ProductBackfillService(db).PlanAsync(CancellationToken.None);

        Assert.AreEqual(1, plan.Products.Count);
        var difference = plan.PriceDifferences.Single();
        Assert.AreEqual("4004", difference.ProductCode);
        Assert.AreEqual(1, difference.OperationNumber);
    }

    [TestMethod]
    public async Task Plan_IgnoresOrdersThatAlreadyHaveAProduct_AndAttachesToExistingProductWithSameSignature()
    {
        await using var db = CreateDb();
        var product = new Product { Code = "4004", Name = "Túi 4004" };
        product.Operations.Add(new ProductOperationTemplate { ProductId = product.Id, OperationNumber = 1, Name = "Cắt", Unit = "cái", SortOrder = 1 });
        db.Products.Add(product);
        var linked = AddOrder(db, "4004 xanh", "Túi 4004 xanh", (1, "Cắt", null));
        linked.ProductId = product.Id;
        AddOrder(db, "4004 vàng", "Túi 4004 vàng", (1, "Cắt", null));
        await db.SaveChangesAsync();
        var service = new ProductBackfillService(db);

        var plan = await service.PlanAsync(CancellationToken.None);
        var assigned = await service.ApplyAsync(plan, CancellationToken.None);

        Assert.AreEqual(1, assigned);
        Assert.AreEqual(1, await db.Products.CountAsync(), "No duplicate product is created.");
        Assert.AreEqual(product.Id, (await db.ProductionOrders.SingleAsync(x => x.Code == "4004 vàng")).ProductId);
    }

    [TestMethod]
    public async Task Plan_SameBaseWithTwoLargeSignatureGroups_OnlyLargestBecomesTheProduct()
    {
        await using var db = CreateDb();
        AddOrder(db, "4004 a", "Túi A", (1, "Cắt", null));
        AddOrder(db, "4004 b", "Túi B", (1, "Cắt", null));
        AddOrder(db, "4004 c", "Túi C", (7, "Khác", null));
        AddOrder(db, "4004 d", "Túi D", (7, "Khác", null));
        AddOrder(db, "4004 e", "Túi E", (1, "Cắt", null));
        await db.SaveChangesAsync();

        var plan = await new ProductBackfillService(db).PlanAsync(CancellationToken.None);

        Assert.AreEqual(1, plan.Products.Count);
        Assert.AreEqual(3, plan.Products[0].Orders.Count);
        Assert.AreEqual(2, plan.Skipped.Count);
    }

    private static async Task SeedSampleAsync(GermanDbContext db)
    {
        AddOrder(db, "4004 xanh", "Túi 4004 xanh", (1, "Cắt vải", 1200m), (2, "May thân", null), (5, "Lắp ráp", null));
        AddOrder(db, "4004 đen", "Túi 4004", (1, "Cắt vải", 1300m), (2, "May thân", null), (5, "Lắp ráp", null));
        AddOrder(db, "TÚI 4004 đỏ", "Túi 4004 đỏ", (8, "Đóng gói", null), (9, "Kiểm", null));
        AddOrder(db, "0417", "Túi 0417", (11, "May", null));
        await db.SaveChangesAsync();
    }

    private static ProductionOrder AddOrder(GermanDbContext db, string code, string name, params (int Number, string Name, decimal? Price)[] operations)
    {
        var order = new ProductionOrder { Code = code, ProductName = name };
        var sort = 1;
        foreach (var operation in operations)
        {
            order.Operations.Add(new ProductionOperation
            {
                ProductionOrderId = order.Id,
                OperationNumber = operation.Number,
                Name = operation.Name,
                Unit = "cái",
                FixedPrice = operation.Price,
                SortOrder = sort++
            });
        }

        db.ProductionOrders.Add(order);
        return order;
    }

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
