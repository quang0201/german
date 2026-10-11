using German.Application.ProductionOrders;
using German.Application.Products;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Products;

[TestClass]
public sealed class ProductServiceTests
{
    private static readonly IReadOnlyList<ProductionOperationInput> ThreeOperations =
    [
        new(1, "Cắt vải", "cái", 1, true, 1200m),
        new(2, "May thân", "cái", 2, true, null),
        new(5, "Lắp ráp", "cái", 3, true, 1800m)
    ];

    [TestMethod]
    public async Task Create_StoresProductWithTemplates()
    {
        await using var db = CreateDb();
        var service = new ProductService(db);

        var result = await service.CreateAsync(new SaveProductCommand("4004", "Túi 4004", true, ThreeOperations), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual("4004", result.Value!.Code);
        CollectionAssert.AreEqual(new[] { 1, 2, 5 }, result.Value.Operations.Select(x => x.OperationNumber).ToArray());
        Assert.AreEqual(0, result.Value.OrderCount);
    }

    [TestMethod]
    public async Task Create_RejectsDuplicateCodeIgnoringCase()
    {
        await using var db = CreateDb();
        var service = new ProductService(db);
        await service.CreateAsync(new SaveProductCommand("4004", "Túi 4004", true, ThreeOperations), CancellationToken.None);

        var result = await service.CreateAsync(new SaveProductCommand(" 4004 ", "Khác", true, []), CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("product.duplicate_code", result.Error!.Code);

        await service.CreateAsync(new SaveProductCommand("ab12", "Sản phẩm ab12", true, []), CancellationToken.None);
        var upper = await service.CreateAsync(new SaveProductCommand("AB12", "Sản phẩm AB12", true, []), CancellationToken.None);
        Assert.AreEqual("product.duplicate_code", upper.Error!.Code);
    }

    [TestMethod]
    public async Task Create_RejectsBlankCodeNameAndDuplicateOperationNumber()
    {
        await using var db = CreateDb();
        var service = new ProductService(db);

        var blank = await service.CreateAsync(new SaveProductCommand("", "Tên", true, []), CancellationToken.None);
        var noName = await service.CreateAsync(new SaveProductCommand("1", "  ", true, []), CancellationToken.None);
        var duplicate = await service.CreateAsync(new SaveProductCommand("4004", "Túi", true, [new(1, "A", "cái", 1), new(1, "B", "cái", 2)]), CancellationToken.None);

        Assert.AreEqual("product.invalid", blank.Error!.Code);
        Assert.AreEqual("product.invalid", noName.Error!.Code);
        Assert.AreEqual("production_operation.duplicate_number", duplicate.Error!.Code);
    }

    [TestMethod]
    public async Task Update_ReplacesTemplatesAndKeepsExistingRowIds()
    {
        await using var db = CreateDb();
        var service = new ProductService(db);
        var created = (await service.CreateAsync(new SaveProductCommand("4004", "Túi 4004", true, ThreeOperations), CancellationToken.None)).Value!;
        var keptId = created.Operations.Single(x => x.OperationNumber == 1).Id;

        var result = await service.UpdateAsync(created.Id, new SaveProductCommand("4004", "Túi 4004 mới", true,
            [new(1, "Cắt vải mới", "cái", 1, true, 1500m), new(9, "Đóng gói", "thùng", 2)]), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual("Túi 4004 mới", result.Value!.Name);
        CollectionAssert.AreEqual(new[] { 1, 9 }, result.Value.Operations.Select(x => x.OperationNumber).ToArray());
        var kept = result.Value.Operations.Single(x => x.OperationNumber == 1);
        Assert.AreEqual(keptId, kept.Id);
        Assert.AreEqual("Cắt vải mới", kept.Name);
        Assert.AreEqual(1500m, kept.FixedPrice);
        Assert.AreEqual(2, await db.ProductOperationTemplates.CountAsync());
    }

    [TestMethod]
    public async Task Update_RejectsCodeOfAnotherProductAndUnknownId()
    {
        await using var db = CreateDb();
        var service = new ProductService(db);
        var first = (await service.CreateAsync(new SaveProductCommand("4004", "A", true, []), CancellationToken.None)).Value!;
        var second = (await service.CreateAsync(new SaveProductCommand("5005", "B", true, []), CancellationToken.None)).Value!;

        var clash = await service.UpdateAsync(second.Id, new SaveProductCommand("4004", "B", true, []), CancellationToken.None);
        var missing = await service.UpdateAsync(Guid.NewGuid(), new SaveProductCommand("9999", "X", true, []), CancellationToken.None);
        var sameCode = await service.UpdateAsync(first.Id, new SaveProductCommand("4004", "A mới", true, []), CancellationToken.None);

        Assert.AreEqual("product.duplicate_code", clash.Error!.Code);
        Assert.AreEqual("product.not_found", missing.Error!.Code);
        Assert.IsTrue(sameCode.IsSuccess);
    }

    [TestMethod]
    public async Task Disable_KeepsProductAndItsOrders_AndListShowsCounts()
    {
        await using var db = CreateDb();
        var service = new ProductService(db);
        var product = (await service.CreateAsync(new SaveProductCommand("4004", "Túi 4004", true, ThreeOperations), CancellationToken.None)).Value!;
        db.ProductionOrders.Add(new ProductionOrder { Code = "4004 xanh", ProductName = "Túi 4004 xanh", ProductId = product.Id });
        await db.SaveChangesAsync();

        var disabled = await service.DisableAsync(product.Id, CancellationToken.None);
        var list = await service.ListAsync(CancellationToken.None);

        Assert.IsTrue(disabled.IsSuccess);
        Assert.AreEqual(1, await db.Products.CountAsync());
        Assert.IsFalse(list.Single().IsActive);
        Assert.AreEqual(3, list.Single().OperationCount);
        Assert.AreEqual(1, list.Single().OrderCount);
        Assert.AreEqual("product.not_found", (await service.DisableAsync(Guid.NewGuid(), CancellationToken.None)).Error!.Code);
    }

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
