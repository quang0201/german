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
public sealed class ProductionEntryBatchDirectAuthorizationTests
{
    [TestMethod]
    public async Task WorkerCannotUseBatchDirect()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E900", FullName = "Worker" };
        var order = new ProductionOrder { Code = "O900", ProductName = "SP", PlannedQuantity = 100m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "CĐ4", Unit = "cái", SortOrder = 4 };
        db.AddRange(employee, order, operation);
        await db.SaveChangesAsync();
        var command = new CreateProductionEntryBatchDirectCommand(
            new DateOnly(2026, 8, 27), employee.Id, order.Id,
            new[] { new CreateProductionEntryBatchDirectItem(operation.Id, 100m, 0m, null) });

        var result = await new ProductionEntryBatchDirectService(db).CreateAsync(
            new CurrentActor(Guid.NewGuid(), UserRole.Worker, employee.Id), command, CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.batch_forbidden", result.Error?.Code);
        Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
    }

    private static GermanDbContext CreateDb() => new(new DbContextOptionsBuilder<GermanDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
