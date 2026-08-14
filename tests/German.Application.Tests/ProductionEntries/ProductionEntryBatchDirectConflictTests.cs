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
public sealed class ProductionEntryBatchDirectConflictTests
{
    [TestMethod]
    public async Task ExistingCellRejectsWholeBatch()
    {
        await using var db = new GermanDbContext(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var employee = new Employee { EmployeeCode = "E901", FullName = "Manager" };
        var order = new ProductionOrder { Code = "O901", ProductName = "SP", PlannedQuantity = 100m, Status = ProductionOrderStatus.InProduction };
        var op4 = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "CĐ4", Unit = "cái", SortOrder = 4 };
        var op5 = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 5, Name = "CĐ5", Unit = "cái", SortOrder = 5 };
        db.AddRange(employee, order, op4, op5);
        db.ProductionEntries.Add(new ProductionEntry { WorkDate = new DateOnly(2026, 8, 27), EmployeeId = employee.Id, ProductionOrderId = order.Id, ProductionOperationId = op5.Id, EntryMode = ProductionEntryMode.Direct, DirectHcQuantity = 25m, DirectTcQuantity = 0m, HcQuantity = 25m, TcQuantity = 0m, TotalQuantity = 25m, SubmittedByUserId = Guid.NewGuid() });
        await db.SaveChangesAsync();
        var command = new CreateProductionEntryBatchDirectCommand(new DateOnly(2026, 8, 27), employee.Id, order.Id, new[] { new CreateProductionEntryBatchDirectItem(op4.Id, 100m, 10m, null), new CreateProductionEntryBatchDirectItem(op5.Id, 100m, 10m, null) });

        var result = await new ProductionEntryBatchDirectService(db).CreateAsync(new CurrentActor(Guid.NewGuid(), UserRole.Manager, employee.Id), command, CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.batch_conflict", result.Error?.Code);
        Assert.AreEqual(1, await db.ProductionEntries.CountAsync());
    }
}
