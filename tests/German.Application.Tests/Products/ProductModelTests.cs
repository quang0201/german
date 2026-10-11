using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Products;

[TestClass]
public sealed class ProductModelTests
{
    [TestMethod]
    public async Task Product_StoresTemplatesAndOrderLink()
    {
        await using var db = CreateDb();
        var product = new Product { Code = "4004", Name = "Túi 4004" };
        product.Operations.Add(new ProductOperationTemplate { ProductId = product.Id, OperationNumber = 1, Name = "Cắt vải", Unit = "cái", SortOrder = 1, FixedPrice = 1200m });
        product.Operations.Add(new ProductOperationTemplate { ProductId = product.Id, OperationNumber = 2, Name = "May thân", Unit = "cái", SortOrder = 2 });
        var order = new ProductionOrder { Code = "4004 xanh", ProductName = "Túi 4004 xanh", ProductId = product.Id };
        db.AddRange(product, order);
        await db.SaveChangesAsync();

        var loaded = await db.Products.Include(x => x.Operations).SingleAsync();
        Assert.AreEqual("4004", loaded.Code);
        Assert.AreEqual(2, loaded.Operations.Count);
        Assert.IsTrue(loaded.IsActive);
        Assert.AreEqual(1200m, loaded.Operations.Single(x => x.OperationNumber == 1).FixedPrice);
        Assert.AreEqual(loaded.Id, (await db.ProductionOrders.SingleAsync()).ProductId);
        Assert.AreEqual(2, await db.ProductOperationTemplates.CountAsync());
    }

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
