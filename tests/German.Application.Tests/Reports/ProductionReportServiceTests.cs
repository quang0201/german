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
            new ProductionReportFilter(null, null, null, null, null, null),
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
        Assert.AreEqual("Tất cả", result.Value.EmployeeLabel);
        Assert.AreEqual("Tất cả", result.Value.OrderLabel);
        Assert.AreEqual("Tất cả", result.Value.OperationLabel);
        Assert.AreEqual("Tất cả", result.Value.SearchLabel);
        Assert.AreEqual("Tổng lượt công đoạn", result.Value.FinalMetricLabel);
    }

    [TestMethod]
    public async Task BuildAsync_RejectsReversedDateRange()
    {
        await using var db = CreateDb();
        var service = new ProductionReportService(db, TimeProvider.System);

        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 13), new DateOnly(2026, 8, 12), null, null, null, null),
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
            new ProductionReportFilter(new DateOnly(2025, 1, 1), new DateOnly(2026, 1, 2), null, null, null, null),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("reports.date_range_too_large", result.Error!.Code);
    }

    [TestMethod]
    public async Task BuildAsync_Allows366DayInclusiveRange()
    {
        await using var db = CreateDb();
        var service = new ProductionReportService(db, TimeProvider.System);

        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2025, 1, 1), new DateOnly(2026, 1, 1), null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
    }

    [TestMethod]
    public async Task BuildAsync_ExcludesSoftDeletedEntries()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        var entry = await db.ProductionEntries.IgnoreQueryFilters().SingleAsync(x => x.Id == seed.Entry.Id);
        entry.IsDeleted = true;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = new ProductionReportService(db, TimeProvider.System);
        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 12), null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(0, result.Value!.Rows.Count);
        Assert.AreEqual(new ProductionReportSummary(0, 0, 0m, 0m, 0m), result.Value.Summary);
        Assert.AreEqual(0, result.Value.ByDay.Count);
        Assert.AreEqual(0, result.Value.ByEmployee.Count);
    }

    [TestMethod]
    public async Task BuildAsync_ExcludesEntriesWithNoProduction()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        await AddEntryAsync(db, seed.Employee, seed.Order, seed.Operation, new DateOnly(2026, 8, 13), 0m, 0m);

        var result = await new ProductionReportService(db, TimeProvider.System).BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 13), null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Rows.Count);
        Assert.AreEqual(new DateOnly(2026, 8, 12), result.Value.Rows[0].WorkDate);
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
            new ProductionReportFilter(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 12), first.Employee.Id, first.Order.Id, first.Operation.Id, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Rows.Count);
        Assert.AreEqual("E001", result.Value.Rows[0].EmployeeCode);
        Assert.AreEqual("0417", result.Value.Rows[0].ProductionOrderCode);
        Assert.AreEqual(11, result.Value.Rows[0].OperationNumber);
        Assert.AreEqual("E001 — Nguyễn Văn A", result.Value.EmployeeLabel);
        Assert.AreEqual("0417 — Túi 0417", result.Value.OrderLabel);
        Assert.AreEqual("CĐ11 — May thân", result.Value.OperationLabel);
        Assert.AreEqual("Tổng sản lượng", result.Value.FinalMetricLabel);
    }

    [DataTestMethod]
    [DataRow(" e001 ")]
    [DataRow("NGUYỄN VĂN A")]
    [DataRow("0417")]
    [DataRow("túi 0417")]
    [DataRow("MAY THÂN")]
    [DataRow("direct")]
    public async Task BuildAsync_AppliesTrimmedSearchAcrossReportFields(string search)
    {
        await using var db = CreateDb();
        await SeedAsync(db, new DateOnly(2026, 8, 12));
        var service = new ProductionReportService(db, TimeProvider.System);

        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 12), null, null, null, search),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Rows.Count);
        Assert.AreEqual(search.Trim(), result.Value.SearchLabel);
    }

    [TestMethod]
    public async Task BuildAsync_DerivesSummaryAndAggregatesFromFilteredRows()
    {
        await using var db = CreateDb();
        var first = await SeedAsync(db, new DateOnly(2026, 8, 12));
        await AddEntryAsync(db, first.Employee, first.Order, first.Operation, new DateOnly(2026, 8, 13), 10m, 5m);

        var employee2 = new Employee { EmployeeCode = "E002", FullName = "Nguyễn Văn B" };
        var order2 = new ProductionOrder { Code = "0521", ProductName = "Túi 0521", PlannedQuantity = 500m, Status = ProductionOrderStatus.InProduction };
        var operation2 = new ProductionOperation { ProductionOrderId = order2.Id, OperationNumber = 6, Name = "Đóng gói", Unit = "thùng", SortOrder = 1 };
        db.AddRange(employee2, order2, operation2);
        await db.SaveChangesAsync();
        await AddEntryAsync(db, employee2, order2, operation2, new DateOnly(2026, 8, 13), 30m, 10m);
        db.ChangeTracker.Clear();

        var service = new ProductionReportService(db, TimeProvider.System);
        var result = await service.BuildAsync(
            new ProductionReportFilter(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 13), null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(new ProductionReportSummary(2, 3, 140m, 35m, 175m), result.Value!.Summary);
        CollectionAssert.AreEqual(
            new[]
            {
                new ProductionReportDaySummary(new DateOnly(2026, 8, 12), 100m, 20m, 120m),
                new ProductionReportDaySummary(new DateOnly(2026, 8, 13), 40m, 15m, 55m)
            },
            result.Value.ByDay.ToArray());
        CollectionAssert.AreEqual(
            new[]
            {
                new ProductionReportEmployeeSummary("E001", "Nguyễn Văn A", 110m, 25m, 135m),
                new ProductionReportEmployeeSummary("E002", "Nguyễn Văn B", 30m, 10m, 40m)
            },
            result.Value.ByEmployee.ToArray());
    }

    [TestMethod]
    public async Task BuildOperationSummaryAsync_AggregatesByOrderAndOperationIncludingZeroAndMixedUnits()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        var secondOperation = new ProductionOperation
        {
            ProductionOrderId = seed.Order.Id,
            OperationNumber = 12,
            Name = "Đóng gói",
            Unit = "thùng",
            SortOrder = 2
        };
        var zeroOperation = new ProductionOperation
        {
            ProductionOrderId = seed.Order.Id,
            OperationNumber = 13,
            Name = "Kiểm hàng",
            Unit = "kiện",
            SortOrder = 3
        };
        db.AddRange(secondOperation, zeroOperation);
        await db.SaveChangesAsync();
        await AddEntryAsync(db, seed.Employee, seed.Order, secondOperation, new DateOnly(2026, 8, 13), 30m, 5m);
        await AddEntryAsync(db, seed.Employee, seed.Order, secondOperation, new DateOnly(2026, 8, 14), 10m, 2m);
        db.ChangeTracker.Clear();

        var result = await new ProductionReportService(db, TimeProvider.System).BuildOperationSummaryAsync(
            seed.Order.Id,
            new DateOnly(2026, 8, 12),
            new DateOnly(2026, 8, 13),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(seed.Order.Id, result.Value!.OrderId);
        Assert.AreEqual("0417", result.Value.OrderCode);
        Assert.AreEqual("Túi 0417", result.Value.ProductName);
        Assert.AreEqual(3, result.Value.OperationCount);
        CollectionAssert.AreEqual(
            new[]
            {
                new ProductionOperationSummary(seed.Operation.Id, 11, "May thân", "cái", 100m, 20m, 120m, 0m, 120m),
                new ProductionOperationSummary(secondOperation.Id, 12, "Đóng gói", "thùng", 30m, 5m, 35m, 0m, 35m),
                new ProductionOperationSummary(zeroOperation.Id, 13, "Kiểm hàng", "kiện", 0m, 0m, 0m, 0m, 0m)
            },
            result.Value.Operations.ToArray());
    }

    [TestMethod]
    public async Task BuildOperationSummaryAsync_AddsExternalQuantityAndKeepsZeroOperation()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        var zeroOperation = new ProductionOperation
        {
            ProductionOrderId = seed.Order.Id,
            OperationNumber = 12,
            Name = "Đóng gói",
            Unit = "thùng",
            SortOrder = 2
        };
        var outside = new ProductionExternalQuantity
        {
            ProductionOrderId = seed.Order.Id,
            ProductionOperationId = seed.Operation.Id,
            ReceivedDate = new DateOnly(2026, 8, 13),
            Quantity = 5000m,
            SubmittedByUserId = Guid.NewGuid()
        };
        var outsideDate = new ProductionExternalQuantity
        {
            ProductionOrderId = seed.Order.Id,
            ProductionOperationId = seed.Operation.Id,
            ReceivedDate = new DateOnly(2026, 8, 20),
            Quantity = 9000m,
            SubmittedByUserId = Guid.NewGuid()
        };
        db.AddRange(zeroOperation, outside, outsideDate);
        await db.SaveChangesAsync();

        var result = await new ProductionReportService(db, TimeProvider.System).BuildOperationSummaryAsync(
            seed.Order.Id, new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 13), CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(2, result.Value!.Operations.Count);
        Assert.AreEqual(5000m, result.Value.Operations[0].ExternalQuantity);
        Assert.AreEqual(5120m, result.Value.Operations[0].CombinedTotalQuantity);
        Assert.AreEqual(0m, result.Value.Operations[1].ExternalQuantity);
        Assert.AreEqual(0m, result.Value.Operations[1].CombinedTotalQuantity);
    }

    [TestMethod]
    public async Task BuildOperationSummaryAsync_FiltersOrderAndDateRange()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        var otherOrder = new ProductionOrder
        {
            Code = "0521",
            ProductName = "Túi 0521",
            PlannedQuantity = 500m,
            Status = ProductionOrderStatus.InProduction
        };
        var otherOperation = new ProductionOperation
        {
            ProductionOrderId = otherOrder.Id,
            OperationNumber = 1,
            Name = "May",
            Unit = "cái",
            SortOrder = 1
        };
        db.AddRange(otherOrder, otherOperation);
        await db.SaveChangesAsync();
        await AddEntryAsync(db, seed.Employee, seed.Order, seed.Operation, new DateOnly(2026, 8, 14), 9m, 1m);
        await AddEntryAsync(db, seed.Employee, otherOrder, otherOperation, new DateOnly(2026, 8, 12), 999m, 1m);
        db.ChangeTracker.Clear();

        var result = await new ProductionReportService(db, TimeProvider.System).BuildOperationSummaryAsync(
            seed.Order.Id,
            new DateOnly(2026, 8, 13),
            new DateOnly(2026, 8, 13),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Operations.Count);
        Assert.AreEqual(0m, result.Value.Operations[0].TotalQuantity);
    }

    [TestMethod]
    public async Task BuildMonthlyOperationSummaryAsync_GroupsEachOperationByMonthAndKeepsZeroOperations()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 6, 12));
        var secondOperation = new ProductionOperation
        {
            ProductionOrderId = seed.Order.Id,
            OperationNumber = 12,
            Name = "Đóng gói",
            Unit = "thùng",
            SortOrder = 2
        };
        db.Add(secondOperation);
        await db.SaveChangesAsync();
        await AddEntryAsync(db, seed.Employee, seed.Order, seed.Operation, new DateOnly(2026, 7, 12), 100m, 20m);
        await AddEntryAsync(db, seed.Employee, seed.Order, seed.Operation, new DateOnly(2026, 8, 3), 40m, 10m);
        db.Add(new ProductionExternalQuantity
        {
            ProductionOrderId = seed.Order.Id,
            ProductionOperationId = seed.Operation.Id,
            ReceivedDate = new DateOnly(2026, 8, 4),
            Quantity = 30m,
            SubmittedByUserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var result = await new ProductionReportService(db, TimeProvider.System)
            .BuildMonthlyOperationSummaryAsync(
                seed.Order.Id,
                new DateOnly(2026, 7, 1),
                new DateOnly(2026, 8, 31),
                CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(2, result.Value!.Months.Count);
        Assert.AreEqual("2026-07", result.Value.Months[0].MonthKey);
        Assert.AreEqual("2026-08", result.Value.Months[1].MonthKey);
        Assert.AreEqual(2, result.Value.Operations.Count);

        var first = result.Value.Operations[0];
        Assert.AreEqual(100m, first.Months[0].HcQuantity);
        Assert.AreEqual(20m, first.Months[0].TcQuantity);
        Assert.AreEqual(120m, first.Months[0].TotalQuantity);
        Assert.AreEqual(30m, first.Months[1].ExternalQuantity);
        Assert.AreEqual(80m, first.Months[1].CombinedTotalQuantity);
        Assert.AreEqual(140m, first.HcQuantity);
        Assert.AreEqual(30m, first.TcQuantity);
        Assert.AreEqual(30m, first.ExternalQuantity);
        Assert.AreEqual(200m, first.CombinedTotalQuantity);

        var zeroOperation = result.Value.Operations[1];
        Assert.AreEqual(12, zeroOperation.OperationNumber);
        Assert.AreEqual(0m, zeroOperation.Months[0].CombinedTotalQuantity);
        Assert.AreEqual(0m, zeroOperation.Months[1].CombinedTotalQuantity);
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

    private static async Task AddEntryAsync(
        GermanDbContext db,
        Employee employee,
        ProductionOrder order,
        ProductionOperation operation,
        DateOnly date,
        decimal hcQuantity,
        decimal tcQuantity)
    {
        db.ProductionEntries.Add(new ProductionEntry
        {
            WorkDate = date,
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = hcQuantity,
            DirectTcQuantity = tcQuantity,
            HcQuantity = hcQuantity,
            TcQuantity = tcQuantity,
            TotalQuantity = hcQuantity + tcQuantity,
            SubmittedByUserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();
    }

    private sealed record SeedData(Employee Employee, ProductionOrder Order, ProductionOperation Operation, ProductionEntry Entry);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
