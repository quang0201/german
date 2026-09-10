using German.Application.ProductionOrders;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionOrders;

[TestClass]
public sealed class ProductionExternalSourceServiceTests
{
    [TestMethod]
    public async Task ManagerCanCreateListAndDeactivateExternalSource()
    {
        await using var db = CreateDb();
        var service = new ProductionExternalSourceService(db);
        var actor = new CurrentActor(Guid.NewGuid(), UserRole.Manager, null);

        var created = await service.CreateAsync(actor, new CreateProductionExternalSourceCommand("  Xưởng ngoài A  "), CancellationToken.None);

        Assert.IsTrue(created.IsSuccess, created.Error?.Message);
        Assert.AreEqual("Xưởng ngoài A", created.Value!.Name);
        Assert.IsTrue(created.Value.IsActive);

        var duplicate = await service.CreateAsync(actor, new CreateProductionExternalSourceCommand("xưởng ngoài a"), CancellationToken.None);
        Assert.IsFalse(duplicate.IsSuccess);
        Assert.AreEqual("production_external_source.duplicate", duplicate.Error?.Code);

        var updated = await service.UpdateAsync(actor, created.Value.Id, new UpdateProductionExternalSourceCommand("Xưởng A đã tắt", false), CancellationToken.None);
        Assert.IsTrue(updated.IsSuccess, updated.Error?.Message);
        Assert.AreEqual("Xưởng A đã tắt", updated.Value!.Name);
        Assert.IsFalse(updated.Value.IsActive);

        var activeOnly = await service.ListAsync(false, CancellationToken.None);
        Assert.AreEqual(0, activeOnly.Count);
        var all = await service.ListAsync(true, CancellationToken.None);
        Assert.AreEqual(1, all.Count);
    }

    [TestMethod]
    public async Task WorkerCannotManageExternalSource()
    {
        await using var db = CreateDb();
        var result = await new ProductionExternalSourceService(db).CreateAsync(
            new CurrentActor(Guid.NewGuid(), UserRole.Worker, Guid.NewGuid()),
            new CreateProductionExternalSourceCommand("Xưởng ngoài"),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_external_source.forbidden", result.Error?.Code);
    }

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);
}
