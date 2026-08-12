using German.Application.ProductionEntries;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionEntryQueryServiceTests
{
    [TestMethod]
    public async Task ListAsync_DefaultsToUtcTodayAndReturnsPagedShape()
    {
        await using var db = CreateDb();
        await SeedEntryAsync(db, new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", "0417", "May thân");
        var service = new ProductionEntryQueryService(
            db,
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 12, 2, 0, 0, TimeSpan.Zero)));

        var result = await service.ListAsync(
            new ProductionEntryListQuery(null, null, null, null, null, null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Items.Count);
        Assert.AreEqual(1, result.Value.TotalCount);
        Assert.AreEqual(1, result.Value.TotalPages);
        Assert.AreEqual(1, result.Value.Page);
        Assert.AreEqual(50, result.Value.PageSize);
        Assert.AreEqual("E001", result.Value.Items[0].EmployeeCode);
    }

    [TestMethod]
    public async Task ListAsync_RejectsConflictingLegacyDateAndRange()
    {
        await using var db = CreateDb();
        var service = new ProductionEntryQueryService(db, TimeProvider.System);

        var result = await service.ListAsync(
            new ProductionEntryListQuery(
                new DateOnly(2026, 8, 12),
                new DateOnly(2026, 8, 12),
                null,
                null,
                null,
                null,
                null,
                null,
                null),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.conflicting_date_filters", result.Error!.Code);
    }

    [TestMethod]
    public async Task ListAsync_RejectsInvalidPageSize()
    {
        await using var db = CreateDb();
        var service = new ProductionEntryQueryService(db, TimeProvider.System);

        var result = await service.ListAsync(
            new ProductionEntryListQuery(null, null, null, null, null, null, null, 1, 30),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("production_entry.invalid_page_size", result.Error!.Code);
    }

    [TestMethod]
    public async Task ListAsync_AppliesSearchBeforePaginationAndUsesStableTieBreakers()
    {
        await using var db = CreateDb();
        var date = new DateOnly(2026, 8, 12);
        await SeedEntryAsync(db, date, "E001", "Nguyễn Văn A", "0417", "May thân");
        await SeedEntryAsync(db, date, "E002", "Trần Văn B", "0417", "May thân");
        await SeedEntryAsync(db, date, "E003", "Trần Văn C", "0521", "Đóng gói");
        var service = new ProductionEntryQueryService(db, TimeProvider.System);

        var result = await service.ListAsync(
            new ProductionEntryListQuery(
                null,
                date,
                date,
                null,
                null,
                null,
                "  0417  ",
                1,
                25),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(2, result.Value!.TotalCount);
        Assert.AreEqual(2, result.Value.Items.Count);
        CollectionAssert.AreEqual(
            new[] { "E001", "E002" },
            result.Value.Items.Select(item => item.EmployeeCode).ToArray());
    }

    [TestMethod]
    public async Task ListAsync_OutOfRangePageReturnsEmptyItemsAndRequestedPage()
    {
        await using var db = CreateDb();
        await SeedEntryAsync(db, new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", "0417", "May thân");
        var service = new ProductionEntryQueryService(db, TimeProvider.System);

        var result = await service.ListAsync(
            new ProductionEntryListQuery(null, new DateOnly(2026, 8, 12), null, null, null, null, null, 3, 25),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(3, result.Value!.Page);
        Assert.AreEqual(1, result.Value.TotalPages);
        Assert.AreEqual(0, result.Value.Items.Count);
    }

    private static GermanDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }

    private static async Task SeedEntryAsync(
        GermanDbContext db,
        DateOnly date,
        string employeeCode,
        string employeeName,
        string orderCode,
        string operationName)
    {
        var employee = new Employee { EmployeeCode = employeeCode, FullName = employeeName };
        var order = new ProductionOrder
        {
            Code = orderCode,
            ProductName = $"Túi {orderCode}",
            PlannedQuantity = 1000m,
            Status = ProductionOrderStatus.InProduction
        };
        var operation = new ProductionOperation
        {
            ProductionOrderId = order.Id,
            OperationNumber = employeeCode == "E003" ? 20 : 10,
            Name = operationName,
            Unit = "cái",
            SortOrder = 1
        };
        var entry = new ProductionEntry
        {
            WorkDate = date,
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 10m,
            DirectTcQuantity = 2m,
            HcQuantity = 10m,
            TcQuantity = 2m,
            TotalQuantity = 12m,
            SubmittedByUserId = Guid.NewGuid()
        };
        db.AddRange(employee, order, operation, entry);
        await db.SaveChangesAsync();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
