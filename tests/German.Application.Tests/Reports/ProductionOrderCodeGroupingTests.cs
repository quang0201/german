using German.Application.Reports;
using German.Domain.Production;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Reports;

[TestClass]
public sealed class ProductionOrderCodeGroupingTests
{
    [TestMethod]
    [DataRow("4004 xanh", "4004")]
    [DataRow("4004 đen", "4004")]
    [DataRow("TÚI 4004 đỏ", "4004")]
    [DataRow("4004-xanh", "4004")]
    [DataRow("0417", "0417")]
    [DataRow("  0417  ", "0417")]
    [DataRow("ABC", "ABC")]
    [DataRow("4004xanh", "4004xanh")]
    [DataRow("A1", "A1")]
    [DataRow("", "")]
    public void BaseCode_UsesTheFirstStandaloneNumberOfAtLeastThreeDigits(string code, string expected)
    {
        Assert.AreEqual(expected, ProductionOrderCodeGrouping.BaseCode(code));
    }

    [TestMethod]
    public void MergeVariants_PutsColourVariantsUnderOneCodeWithoutChangingQuantities()
    {
        var day = new DateOnly(2026, 10, 1);
        var rows = new[]
        {
            Row(day, "4004 xanh", "Túi 4004 xanh", 1, 6613m, 2387m),
            Row(day, "4004 đen", "Túi 4004 đen", 1, 17330m, 8370m),
            Row(day, "TÚI 4004 đỏ", "Túi 4004 đỏ", 8, 156m, 47m),
            Row(day, "0417", "Túi 0417", 13, 800m, 100m),
        };

        var merged = ProductionOrderCodeGrouping.MergeVariants(rows);

        CollectionAssert.AreEquivalent(new[] { "0417", "4004" }, merged.Select(row => row.ProductionOrderCode).Distinct().ToArray());
        Assert.AreEqual(rows.Sum(row => row.HcQuantity), merged.Sum(row => row.HcQuantity));
        Assert.AreEqual(rows.Sum(row => row.TcQuantity), merged.Sum(row => row.TcQuantity));
        Assert.AreEqual(rows.Sum(row => row.TotalQuantity), merged.Sum(row => row.TotalQuantity));
        var cd1 = merged.Where(row => row.ProductionOrderCode == "4004" && row.OperationNumber == 1).ToArray();
        Assert.AreEqual(2, cd1.Length, "Per-entry rows are kept; the exporter sums them per employee, code and operation.");
        Assert.AreEqual(6613m + 17330m, cd1.Sum(row => row.HcQuantity));
        Assert.AreEqual("Túi 4004 xanh / Túi 4004 đen / Túi 4004 đỏ", merged.First(row => row.ProductionOrderCode == "4004").ProductName);
        Assert.AreEqual("Túi 0417", merged.Single(row => row.ProductionOrderCode == "0417").ProductName);
    }

    [TestMethod]
    public void MergeVariants_KeepsEmployeeIdAndExternalFlag()
    {
        var id = Guid.NewGuid();
        var row = Row(new DateOnly(2026, 10, 1), "4004 xanh", "Túi", 1, 10m, 0m) with { EmployeeId = id, IsExternal = true };

        var merged = ProductionOrderCodeGrouping.MergeVariants([row]).Single();

        Assert.AreEqual(id, merged.EmployeeId);
        Assert.IsTrue(merged.IsExternal);
    }

    private static ProductionReportRow Row(DateOnly date, string code, string name, int operation, decimal hc, decimal tc) => new(
        date, "E001", "Bùi Huyền Dung", code, name, operation, $"CĐ{operation}", "cái", hc, tc, hc + tc, null, ProductionEntryMode.Direct, null);
}
