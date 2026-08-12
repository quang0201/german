using German.Application.Reports;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Reports;

[TestClass]
public sealed class ProductionReportServiceTests
{
    [TestMethod]
    public async Task BuildAsync_DefaultsToUtcTodayAndMapsRows()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        var service = new ProductionReportService(
            db,
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 12, 3, 0, 0, TimeSpan.Zero)));

        var result = await service.BuildAsync(
            new ProductionReportFilter(null, null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(new DateOnly(2026, 8, 12), result.Value!.FromDate);
        Assert.AreEqual(new DateOnly(2026, 8, 12), result.Value.UntilDate);
        Assert.AreEqual(1, result.Value.Rows.Count);
        var row = result.Value.Rows[0];
        Assert.AreEqual("E001", row.EmployeeCode);
        Assert.AreEqual("Nguyễn Văn A", row.EmployeeName);
        Assert.AreEqual("0417", row.ProductionOrderCode);
        Assert.AreEqual("Túi 0417", row.ProductName);
        Assert.AreEqual(11, row.OperationNumber);
        Assert.AreEqual("May thân", row.OperationName);
        Assert.AreEqual("cái", row.Unit);
        Assert.AreEqual(100m, row.HcQuantity);
        Assert.AreEqual(20m, row.TcQuantity);
        Assert.AreEqual(120m, row.TotalQuantity);
        Assert.AreEqual(seed.Entry.OvertimeHours, row.OvertimeHours);
    }

    [TestMethod]
    public async Task BuildAsync_RejectsReversedDateRange()
    {
        await using var db = CreateDb();
        var service = new ProductionReportService(db, TimeProvider.System);

        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 13), new DateOnly(2026, 8, 12), null, null, null),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("reports.invalid_date_range", result.Error!.Code);
    }

    [TestMethod]
    public async Task BuildAsync_RejectsRangeLongerThan366Days()
    {
        await using var db = CreateDb();
        var service = new ProductionReportService(db, TimeProvider.System);

        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2025, 1, 1), new DateOnly(2026, 1, 2), null, null, null),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("reports.date_range_too_large", result.Error!.Code);
    }

    [TestMethod]
    public async Task BuildAsync_ExcludesSoftDeletedEntries()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        seed.Entry.IsDeleted = true;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = new ProductionReportService(db, TimeProvider.System);
        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 12), null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(0, result.Value!.Rows.Count);
    }

    [TestMethod]
    public async Task BuildAsync_AppliesEmployeeOrderAndOperationFilters()
    {
        await using var db = CreateDb();
        var first = await SeedAsync(db, new DateOnly(2026, 8, 12));

        var employee2 = new Employee { EmployeeCode = "E002", FullName = "Nguyễn Văn B" };
        var order2 = new ProductionOrder { Code = "0521", ProductName = "Túi 0521", PlannedQuantity = 500m, Status = ProductionOrderStatus.InProduction };
        var operation2 = new ProductionOperation { ProductionOrderId = order2.Id, OperationNumber = 6, Name = "Đóng gói", Unit = "thùng", SortOrder = 1 };
        var account2 = new UserAccount { Username = "worker2", NormalizedUsername = "WORKER2", PasswordHash = "test", Role = UserRole.Worker, EmployeeId = employee2.Id };
        var entry2 = new ProductionEntry
        {
            WorkDate = new DateOnly(2026, 8, 12),
            EmployeeId = employee2.Id,
            ProductionOrderId = order2.Id,
            ProductionOperationId = operation2.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 30m,
            DirectTcQuantity = 0m,
            HcQuantity = 30m,
            TcQuantity = 0m,
            TotalQuantity = 30m,
            SubmittedByUserId = account2.Id
        };
        db.AddRange(employee2, order2, operation2, account2, entry2);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = new ProductionReportService(db, TimeProvider.System);
        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 12), first.Employee.Id, first.Order.Id, first.Operation.Id),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Rows.Count);
        Assert.AreEqual("E001", result.Value.Rows[0].EmployeeCode);
        Assert.AreEqual("0417", result.Value.Rows[0].ProductionOrderCode);
        Assert.AreEqual(11, result.Value.Rows[0].OperationNumber);
    }

    private static GermanDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }

    private static async Task<SeedData> SeedAsync(GermanDbContext db, DateOnly date)
    {
        var employee = new Employee { EmployeeCode = "E001", FullName = "Nguyễn Văn A" };
        var order = new ProductionOrder { Code = "0417", ProductName = "Túi 0417", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
        var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 11, Name = "May thân", Unit = "cái", SortOrder = 1 };
        var account = new UserAccount { Username = "worker1", NormalizedUsername = "WORKER1", PasswordHash = "test", Role = UserRole.Worker, EmployeeId = employee.Id };
        var entry = new ProductionEntry
        {
            WorkDate = date,
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 100m,
            DirectTcQuantity = 20m,
            OvertimeHours = 2m,
            HcQuantity = 100m,
            TcQuantity = 20m,
            TotalQuantity = 120m,
            SubmittedByUserId = account.Id,
            Note = "Ca chiều"
        };
        db.AddRange(employee, order, operation, account, entry);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return new SeedData(employee, order, operation, entry);
    }

    private sealed record SeedData(Employee Employee, ProductionOrder Order, ProductionOperation Operation, ProductionEntry Entry);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
