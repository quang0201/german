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
public sealed class ProductionEntryBatchDirectSuccessTests
{
    [TestMethod]
    public async Task CreatesAllSelectedOperationsAsDirect()
    {
        await using var db = new GermanDbContext(new DbContextOptionsBuilder<GermanDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var employee = new Employee { EmployeeCode = "E902", FullName = "Admin" };
        var order = new ProductionOrder { Code = "O902", ProductName = "SP", PlannedQuantity = 100m, Status = ProductionOrderStatus.InProduction };
        var operations = new[] { 4, 5, 6, 100 }.Select(number => new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = number, Name = $"CĐ{number}", Unit = "cái", SortOrder = number }).ToArray();
        db.AddRange(employee, order); db.ProductionOperations.AddRange(operations); await db.SaveChangesAsync();
        var quantities = new[] { (100m, 0m), (100m, 20m), (80m, 10m), (40m, 5m) };
        var items = operations.Select((operation, index) => new CreateProductionEntryBatchDirectItem(operation.Id, quantities[index].Item1, quantities[index].Item2, null)).ToArray();
        var command = new CreateProductionEntryBatchDirectCommand(new DateOnly(2026, 8, 27), employee.Id, order.Id, items);

        var result = await new ProductionEntryBatchDirectService(db).CreateAsync(new CurrentActor(Guid.NewGuid(), UserRole.Admin, employee.Id), command, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(4, result.Value!.CreatedCount);
        var entries = await db.ProductionEntries.ToListAsync();
        Assert.AreEqual(4, entries.Count);
        Assert.IsTrue(entries.All(entry => entry.EntryMode == ProductionEntryMode.Direct));
        Assert.AreEqual(355m, entries.Sum(entry => entry.TotalQuantity));
    }
}
