using German.Application.ProductionEntries;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionEntryQueryServiceTests
{
    [DataTestMethod]
    [DataRow("  BYSHIFT  ", "byshift", ProductionEntryMode.ByShift)]
    [DataRow("theo ca", "theo ca", ProductionEntryMode.ByShift)]
    [DataRow("HC / TC TRỰC TIẾP", "hc / tc trực tiếp", ProductionEntryMode.Direct)]
    [DataRow("hc/tc trực tiếp", "hc/tc trực tiếp", ProductionEntryMode.Direct)]
    [DataRow("TỔNG + GIỜ TC", "tổng + giờ tc", ProductionEntryMode.TotalWithOvertime)]
    [DataRow("tổng + giờ tăng ca", "tổng + giờ tăng ca", ProductionEntryMode.TotalWithOvertime)]
    public void ProductionEntrySearch_NormalizesTextAndEntryModeAliases(
        string search,
        string expectedLoweredText,
        ProductionEntryMode expectedMode)
    {
        var criteria = ProductionEntrySearch.Normalize(search);

        Assert.IsNotNull(criteria);
        Assert.AreEqual(search.Trim(), criteria.Text);
        Assert.AreEqual(expectedLoweredText, criteria.LoweredText);
        CollectionAssert.AreEqual(new[] { expectedMode }, criteria.EntryModes.ToArray());
    }

    [DataTestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("   ")]
    public void ProductionEntrySearch_EmptyTextHasNoCriteria(string? search)
    {
        Assert.IsNull(ProductionEntrySearch.Normalize(search));
    }

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
    public async Task ListAsync_ExcludesEntriesWithNoProduction()
    {
        await using var db = CreateDb();
        var date = new DateOnly(2026, 8, 12);
        await SeedEntryAsync(db, date, "E001", "Nguyễn Văn A", "0417", "May thân");
        var zeroEntry = await SeedEntryAsync(db, date, "E002", "Trần Văn B", "0417", "May thân");
        zeroEntry.HcQuantity = 0m;
        zeroEntry.TcQuantity = 0m;
        zeroEntry.TotalQuantity = 0m;
        await db.SaveChangesAsync();

        var result = await new ProductionEntryQueryService(db, TimeProvider.System).ListAsync(
            new ProductionEntryListQuery(null, date, date, null, null, null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Items.Count);
        Assert.AreEqual(1, result.Value.TotalCount);
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

    [TestMethod]
    public async Task ListAsync_SummarizesAllFilteredEntriesBeforePagination()
    {
        await using var db = CreateDb();
        var date = new DateOnly(2026, 8, 12);
        await SeedEntryAsync(db, date, "E001", "Nguyễn Văn A", "0417", "May thân");
        var secondEmployeeEntry = await SeedEntryAsync(db, date, "E002", "Trần Văn B", "0417", "May thân");
        await SeedEntryAsync(
            db,
            date,
            "E002",
            "Trần Văn B",
            "0417",
            "May thân",
            await db.Employees.SingleAsync(employee => employee.Id == secondEmployeeEntry.EmployeeId));
        var service = new ProductionEntryQueryService(db, TimeProvider.System);

        var result = await service.ListAsync(
            new ProductionEntryListQuery(null, date, date, null, null, null, null, 2, 25),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(0, result.Value!.Items.Count);
        Assert.AreEqual(2, result.Value.Summary.EmployeeCount);
        Assert.AreEqual(3, result.Value.Summary.EntryCount);
        Assert.AreEqual(30m, result.Value.Summary.HcQuantity);
        Assert.AreEqual(6m, result.Value.Summary.TcQuantity);
        Assert.AreEqual(36m, result.Value.Summary.TotalQuantity);
    }

    [TestMethod]
    public async Task ListMineAsync_SummaryExcludesOtherEmployees()
    {
        await using var db = CreateDb();
        var date = new DateOnly(2026, 8, 12);
        var workerEntry = await SeedEntryAsync(db, date, "E001", "Nguyễn Văn A", "0417", "May thân");
        await SeedEntryAsync(db, date, "E002", "Trần Văn B", "0417", "May thân");
        var service = new ProductionEntryQueryService(db, TimeProvider.System);

        var result = await service.ListMineAsync(
            new CurrentActor(Guid.NewGuid(), UserRole.Worker, workerEntry.EmployeeId),
            new ProductionEntryListQuery(null, date, date, null, null, null, null, 1, 25),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Items.Count);
        Assert.AreEqual(1, result.Value.Summary.EmployeeCount);
        Assert.AreEqual(1, result.Value.Summary.EntryCount);
        Assert.AreEqual(10m, result.Value.Summary.HcQuantity);
        Assert.AreEqual(2m, result.Value.Summary.TcQuantity);
        Assert.AreEqual(12m, result.Value.Summary.TotalQuantity);
    }

    private static GermanDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }

    private static async Task<ProductionEntry> SeedEntryAsync(
        GermanDbContext db,
        DateOnly date,
        string employeeCode,
        string employeeName,
        string orderCode,
        string operationName,
        Employee? employee = null)
    {
        employee ??= new Employee { EmployeeCode = employeeCode, FullName = employeeName };
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
        if (db.Entry(employee).State == EntityState.Detached)
        {
            db.Add(employee);
        }

        db.AddRange(order, operation, entry);
        await db.SaveChangesAsync();
        return entry;
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
