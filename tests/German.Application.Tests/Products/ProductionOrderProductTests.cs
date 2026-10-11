using German.Application.ProductionOrders;
using German.Application.Products;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Products;

[TestClass]
public sealed class ProductionOrderProductTests
{
    [TestMethod]
    public async Task Create_WithProduct_CopiesActiveTemplateOperations()
    {
        await using var db = CreateDb();
        var product = await SeedProductAsync(db);
        var service = new ProductionOrderService(db);

        var result = await service.CreateAsync(Command("4004 xanh", product.Id, operations: null), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(product.Id, result.Value!.ProductId);
        Assert.AreEqual("4004", result.Value.ProductCode);
        CollectionAssert.AreEqual(new[] { 1, 2 }, result.Value.Operations.Select(x => x.OperationNumber).ToArray());
        Assert.AreEqual(1200m, result.Value.Operations.Single(x => x.OperationNumber == 1).FixedPrice);
        var stored = await db.ProductionOperations.Where(x => x.ProductionOrderId == result.Value.Id).ToListAsync();
        Assert.AreEqual(2, stored.Count, "The order keeps its own copy of the operations.");
    }

    [TestMethod]
    public async Task Create_WithProductAndExplicitOperations_UsesTheSubmittedList()
    {
        await using var db = CreateDb();
        var product = await SeedProductAsync(db);
        var service = new ProductionOrderService(db);

        var result = await service.CreateAsync(Command("TÚI 4004 đỏ", product.Id, [new ProductionOperationInput(8, "May đáy", "cái", 1)]), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        CollectionAssert.AreEqual(new[] { 8 }, result.Value!.Operations.Select(x => x.OperationNumber).ToArray());
        Assert.AreEqual(product.Id, result.Value.ProductId);
    }

    [TestMethod]
    public async Task Create_WithUnknownProduct_IsRejected()
    {
        await using var db = CreateDb();
        var service = new ProductionOrderService(db);

        var result = await service.CreateAsync(Command("4004 xanh", Guid.NewGuid(), null), CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("product.not_found", result.Error!.Code);
        Assert.AreEqual(0, await db.ProductionOrders.CountAsync());
    }

    [TestMethod]
    public async Task Update_AssigningAProduct_DoesNotTouchOperations_AndClearingRemovesTheLink()
    {
        await using var db = CreateDb();
        var product = await SeedProductAsync(db);
        var service = new ProductionOrderService(db);
        var order = (await service.CreateAsync(Command("0417", null, [new ProductionOperationInput(11, "May thân", "cái", 1)]), CancellationToken.None)).Value!;

        var assigned = await service.UpdateAsync(order.Id, new UpdateProductionOrderCommand("0417", "Túi 0417", 100m, ProductionOrderStatus.Draft, null, null, product.Id), CancellationToken.None);
        Assert.IsTrue(assigned.IsSuccess, assigned.Error?.Message);
        Assert.AreEqual(product.Id, assigned.Value!.ProductId);
        CollectionAssert.AreEqual(new[] { 11 }, assigned.Value.Operations.Select(x => x.OperationNumber).ToArray());

        var untouched = await service.UpdateAsync(order.Id, new UpdateProductionOrderCommand("0417", "Túi 0417", 100m, ProductionOrderStatus.Draft, null, null), CancellationToken.None);
        Assert.AreEqual(product.Id, untouched.Value!.ProductId, "A legacy client that omits productId must not clear the link.");

        var cleared = await service.UpdateAsync(order.Id, new UpdateProductionOrderCommand("0417", "Túi 0417", 100m, ProductionOrderStatus.Draft, null, null, null, true), CancellationToken.None);
        Assert.IsNull(cleared.Value!.ProductId);

        var unknown = await service.UpdateAsync(order.Id, new UpdateProductionOrderCommand("0417", "Túi 0417", 100m, ProductionOrderStatus.Draft, null, null, Guid.NewGuid()), CancellationToken.None);
        Assert.AreEqual("product.not_found", unknown.Error!.Code);
    }

    [TestMethod]
    public async Task ListAndGet_ReportTheProductCode()
    {
        await using var db = CreateDb();
        var product = await SeedProductAsync(db);
        var service = new ProductionOrderService(db);
        var withProduct = (await service.CreateAsync(Command("4004 xanh", product.Id, null), CancellationToken.None)).Value!;
        await service.CreateAsync(Command("0417", null, [new ProductionOperationInput(11, "May", "cái", 1)]), CancellationToken.None);

        var list = await service.ListAsync(CancellationToken.None);
        var single = await service.GetAsync(withProduct.Id, CancellationToken.None);

        Assert.AreEqual("4004", list.Single(x => x.Code == "4004 xanh").ProductCode);
        Assert.IsNull(list.Single(x => x.Code == "0417").ProductCode);
        Assert.AreEqual("4004", single.Value!.ProductCode);
    }

    private static CreateProductionOrderCommand Command(string code, Guid? productId, IReadOnlyList<ProductionOperationInput>? operations) =>
        new(code, "Túi " + code, 100m, ProductionOrderStatus.Draft, null, null, null, operations, productId);

    private static async Task<ProductDto> SeedProductAsync(GermanDbContext db)
    {
        var result = await new ProductService(db).CreateAsync(new SaveProductCommand("4004", "Túi 4004", true,
        [
            new ProductionOperationInput(1, "Cắt vải", "cái", 1, true, 1200m),
            new ProductionOperationInput(2, "May thân", "cái", 2),
            new ProductionOperationInput(3, "Đã bỏ", "cái", 3, false)
        ]), CancellationToken.None);
        return result.Value!;
    }

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
