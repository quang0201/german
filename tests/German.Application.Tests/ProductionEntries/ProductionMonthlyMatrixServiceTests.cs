using German.Application.ProductionEntries;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionMonthlyMatrixServiceTests
{
    [TestMethod]
    public async Task GetAsync_GroupsMultipleOrdersAndEmployeeOperations()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E001", FullName = "Bạch Thị Đào" };
        var order0417 = NewOrder("0417", "Mã hàng 0417");
        var order0521 = NewOrder("0521", "Áo 0521");
        var op11 = NewOperation(order0417, 11, "May thân");
        var op12 = NewOperation(order0417, 12, "May đáy");
        var op16 = NewOperation(order0417, 16, "Đóng gói");
        var op3 = NewOperation(order0521, 3, "Cắt");
        db.AddRange(employee, order0417, order0521, op11, op12, op16, op3);
        AddEntry(db, employee, order0417, op11, new DateOnly(2026, 8, 5), 100m, 20m);
        AddEntry(db, employee, order0417, op12, new DateOnly(2026, 8, 5), 80m, 10m);
        AddEntry(db, employee, order0417, op16, new DateOnly(2026, 8, 6), 70m, 0m);
        AddEntry(db, employee, order0521, op3, new DateOnly(2026, 8, 13), 50m, 5m);
        await db.SaveChangesAsync();

        var result = await new ProductionMonthlyMatrixService(db).GetAsync(
            new ProductionMonthlyMatrixQuery(2026, 8, null, null, null, null, false),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(new DateOnly(2026, 8, 1), result.Value!.FromDate);
        Assert.AreEqual(new DateOnly(2026, 8, 31), result.Value.UntilDate);
        Assert.AreEqual(2, result.Value.AvailableOrders.Count);
        Assert.AreEqual(2, result.Value.Orders.Count);
        var firstBlock = result.Value.Orders.Single(x => x.OrderCode == "0417");
        Assert.AreEqual(1, firstBlock.Employees.Count);
        Assert.AreEqual(3, firstBlock.Employees[0].Operations.Count);
        Assert.AreEqual(300m, firstBlock.Employees[0].Operations.Sum(x => x.TotalQuantity));
        Assert.AreEqual(4, result.Value.Summary.EntryCount);
        Assert.AreEqual(300m, result.Value.Summary.HcQuantity);
        Assert.AreEqual(35m, result.Value.Summary.TcQuantity);
        Assert.AreEqual(335m, result.Value.Summary.TotalQuantity);
    }

    [TestMethod]
    public async Task GetAsync_UsesLeapFebruaryCalendarBoundary()
    {
        await using var db = CreateDb();
        var result = await new ProductionMonthlyMatrixService(db).GetAsync(
            new ProductionMonthlyMatrixQuery(2028, 2, null, null, null, null, true),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(new DateOnly(2028, 2, 1), result.Value!.FromDate);
        Assert.AreEqual(new DateOnly(2028, 2, 29), result.Value.UntilDate);
        Assert.AreEqual(0, result.Value.Summary.EntryCount);
    }

    [TestMethod]
    public async Task GetAsync_ExcludesSundayBeforeSummaryAndCells()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E002", FullName = "Bùi Thu Hiền" };
        var order = NewOrder("0417", "Mã hàng 0417");
        var operation = NewOperation(order, 14, "May quai");
        db.AddRange(employee, order, operation);
        AddEntry(db, employee, order, operation, new DateOnly(2026, 8, 16), 100m, 10m);
        AddEntry(db, employee, order, operation, new DateOnly(2026, 8, 17), 200m, 20m);
        await db.SaveChangesAsync();

        var service = new ProductionMonthlyMatrixService(db);
        var hidden = await service.GetAsync(
            new ProductionMonthlyMatrixQuery(2026, 8, null, null, null, null, true),
            CancellationToken.None);
        var visible = await service.GetAsync(
            new ProductionMonthlyMatrixQuery(2026, 8, null, null, null, null, false),
            CancellationToken.None);

        Assert.IsTrue(hidden.IsSuccess, hidden.Error?.Message);
        Assert.AreEqual(1, hidden.Value!.Summary.EntryCount);
        Assert.AreEqual(220m, hidden.Value.Summary.TotalQuantity);
        Assert.AreEqual(1, hidden.Value.Orders[0].Employees[0].Operations[0].Cells.Count);
        Assert.AreEqual(new DateOnly(2026, 8, 17), hidden.Value.Orders[0].Employees[0].Operations[0].Cells[0].WorkDate);
        Assert.IsTrue(visible.IsSuccess, visible.Error?.Message);
        Assert.AreEqual(2, visible.Value!.Summary.EntryCount);
        Assert.AreEqual(330m, visible.Value.Summary.TotalQuantity);
    }

    [TestMethod]
    public async Task GetAsync_PreservesMultipleUnderlyingRecordsInOneCell()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E003", FullName = "Bùi Thị Hải Yến" };
        var order = NewOrder("0417", "Mã hàng 0417");
        var operation = NewOperation(order, 8, "Ép");
        db.AddRange(employee, order, operation);
        var first = AddEntry(db, employee, order, operation, new DateOnly(2026, 8, 10), 300m, 50m, ProductionEntryMode.Direct, "direct", 3);
        var second = AddEntry(db, employee, order, operation, new DateOnly(2026, 8, 10), 100m, 25m, ProductionEntryMode.ByShift, "shift", 5);
        await db.SaveChangesAsync();

        var result = await new ProductionMonthlyMatrixService(db).GetAsync(
            new ProductionMonthlyMatrixQuery(2026, 8, null, null, null, null, false),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        var cell = result.Value!.Orders[0].Employees[0].Operations[0].Cells.Single();
        Assert.AreEqual(2, cell.EntryCount);
        Assert.AreEqual(400m, cell.HcQuantity);
        Assert.AreEqual(75m, cell.TcQuantity);
        CollectionAssert.AreEquivalent(new[] { first.Id, second.Id }, cell.Records.Select(x => x.Id).ToArray());
        Assert.AreEqual(3, cell.Records.Single(x => x.Id == first.Id).Version);
        Assert.AreEqual(ProductionEntryMode.ByShift, cell.Records.Single(x => x.Id == second.Id).EntryMode);
        Assert.AreEqual("shift", cell.Records.Single(x => x.Id == second.Id).Note);
    }

    [TestMethod]
    public async Task GetAsync_OrderFilterKeepsToolbarOptionsButFiltersBlocksAndSummary()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E004", FullName = "Bạch Thị Nương" };
        var order0417 = NewOrder("0417", "Mã hàng 0417");
        var order0521 = NewOrder("0521", "Áo 0521");
        var op0417 = NewOperation(order0417, 19, "Kiểm");
        var op0521 = NewOperation(order0521, 7, "May");
        db.AddRange(employee, order0417, order0521, op0417, op0521);
        AddEntry(db, employee, order0417, op0417, new DateOnly(2026, 8, 10), 100m, 0m);
        AddEntry(db, employee, order0521, op0521, new DateOnly(2026, 8, 10), 200m, 0m);
        await db.SaveChangesAsync();

        var result = await new ProductionMonthlyMatrixService(db).GetAsync(
            new ProductionMonthlyMatrixQuery(2026, 8, null, order0521.Id, null, null, false),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(2, result.Value!.AvailableOrders.Count);
        Assert.AreEqual(1, result.Value.Orders.Count);
        Assert.AreEqual("0521", result.Value.Orders[0].OrderCode);
        Assert.AreEqual(1, result.Value.Summary.EntryCount);
        Assert.AreEqual(200m, result.Value.Summary.TotalQuantity);
    }

    private static GermanDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }

    private static ProductionOrder NewOrder(string code, string productName) => new()
    {
        Code = code,
        ProductName = productName,
        PlannedQuantity = 10000m,
        Status = ProductionOrderStatus.InProduction
    };

    private static ProductionOperation NewOperation(ProductionOrder order, int number, string name) => new()
    {
        ProductionOrderId = order.Id,
        OperationNumber = number,
        Name = name,
        Unit = "cái",
        SortOrder = number
    };

    private static ProductionEntry AddEntry(
        GermanDbContext db,
        Employee employee,
        ProductionOrder order,
        ProductionOperation operation,
        DateOnly date,
        decimal hc,
        decimal tc,
        ProductionEntryMode mode = ProductionEntryMode.Direct,
        string? note = null,
        int version = 1)
    {
        var entry = new ProductionEntry
        {
            WorkDate = date,
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = mode,
            DirectHcQuantity = mode == ProductionEntryMode.Direct ? hc : null,
            DirectTcQuantity = mode == ProductionEntryMode.Direct ? tc : null,
            HcQuantity = hc,
            TcQuantity = tc,
            TotalQuantity = hc + tc,
            Note = note,
            Version = version,
            SubmittedByUserId = Guid.NewGuid()
        };
        db.Add(entry);
        return entry;
    }
}
