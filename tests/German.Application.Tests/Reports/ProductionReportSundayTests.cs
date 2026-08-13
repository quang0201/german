using German.Application.Reports;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Reports;

[TestClass]
public sealed class ProductionReportSundayTests
{
    [TestMethod]
    public async Task BuildAsync_ExcludeSundays_RemovesSundayFromRowsAndAggregates()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E001", FullName = "Nguyễn Văn A" };
        var order = new ProductionOrder { Code = "0417", ProductName = "Túi 0417", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 11, Name = "May thân", Unit = "cái", SortOrder = 1 };
        var account = new UserAccount { Username = "worker1", NormalizedUsername = "WORKER1", PasswordHash = "test", Role = UserRole.Worker, EmployeeId = employee.Id };
        db.AddRange(employee, order, operation, account);
        await db.SaveChangesAsync();

        db.ProductionEntries.AddRange(
            Entry(new DateOnly(2026, 8, 16), 70m, 10m, employee, order, operation, account),
            Entry(new DateOnly(2026, 8, 17), 30m, 5m, employee, order, operation, account));
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = new ProductionReportService(db, TimeProvider.System);
        var result = await service.BuildAsync(
            new ProductionReportFilter(
                new DateOnly(2026, 8, 16),
                new DateOnly(2026, 8, 17),
                null,
                null,
                null,
                null,
                true),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.IsTrue(result.Value!.ExcludeSundays);
        Assert.AreEqual(1, result.Value.Rows.Count);
        Assert.AreEqual(new DateOnly(2026, 8, 17), result.Value.Rows.Single().WorkDate);
        Assert.AreEqual(new ProductionReportSummary(1, 1, 30m, 5m, 35m), result.Value.Summary);
        CollectionAssert.AreEqual(
            new[] { new ProductionReportDaySummary(new DateOnly(2026, 8, 17), 30m, 5m, 35m) },
            result.Value.ByDay.ToArray());
        CollectionAssert.AreEqual(
            new[] { new ProductionReportEmployeeSummary("E001", "Nguyễn Văn A", 30m, 5m, 35m) },
            result.Value.ByEmployee.ToArray());
    }

    private static GermanDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }

    private static ProductionEntry Entry(
        DateOnly date,
        decimal hc,
        decimal tc,
        Employee employee,
        ProductionOrder order,
        ProductionOperation operation,
        UserAccount account)
        => new()
        {
            WorkDate = date,
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = hc,
            DirectTcQuantity = tc,
            HcQuantity = hc,
            TcQuantity = tc,
            TotalQuantity = hc + tc,
            SubmittedByUserId = account.Id
        };
}
