using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;
using German.Infrastructure.Excel;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Infrastructure.Tests.Excel;

[TestClass]
public sealed class OpenXmlProductionMonthlyReportExporterTests
{
    [TestMethod]
    public void Export_WritesOnlyMonthlyHcTcColumnsForEachOperation()
    {
        using var document = SpreadsheetDocument.Open(
            new MemoryStream(new OpenXmlProductionMonthlyReportExporter().Export(CreateReport())),
            false);
        var sheets = document.WorkbookPart!.Workbook!.Sheets!.Elements<Sheet>().ToList();
        Assert.AreEqual(1, sheets.Count);
        Assert.AreEqual("Báo cáo tháng", sheets[0].Name!.Value);

        var relationshipId = sheets[0].Id?.Value ?? throw new AssertFailedException("Worksheet relationship is missing.");
        var worksheet = (WorksheetPart)document.WorkbookPart.GetPartById(relationshipId);
        var rows = worksheet.Worksheet!.GetFirstChild<SheetData>()!.Elements<Row>().ToList();
        CollectionAssert.AreEqual(
            new[] { "Công đoạn", "Tên công đoạn", "ĐVT", "07/2026", "08/2026", "Tổng HC", "Tổng TC", "Tổng" },
            Cells(rows.Single(row => row.RowIndex!.Value == 4U)));
        CollectionAssert.AreEqual(
            new[] { "HC", "TC", "HC", "TC" },
            Cells(rows.Single(row => row.RowIndex!.Value == 5U)).Skip(3).ToArray());

        var data = rows.Single(row => row.RowIndex!.Value == 6U);
        Assert.AreEqual("CĐ9", Cell(data, "A6").InnerText);
        Assert.AreEqual("May thân", Cell(data, "B6").InnerText);
        Assert.AreEqual("100", Cell(data, "D6").CellValue!.Text);
        Assert.AreEqual("20", Cell(data, "E6").CellValue!.Text);
        Assert.AreEqual("40", Cell(data, "F6").CellValue!.Text);
        Assert.AreEqual("10", Cell(data, "G6").CellValue!.Text);
        Assert.AreEqual("140", Cell(data, "H6").CellValue!.Text);
        Assert.AreEqual("30", Cell(data, "I6").CellValue!.Text);
        Assert.AreEqual("170", Cell(data, "J6").CellValue!.Text);
        Assert.IsFalse(worksheet.Worksheet.InnerText.Contains("Nội bộ", StringComparison.Ordinal));
        Assert.IsFalse(worksheet.Worksheet.InnerText.Contains("Bên ngoài", StringComparison.Ordinal));
    }

    private static ProductionMonthlyOperationSummaryReport CreateReport() => new(
        Guid.NewGuid(),
        "0417",
        "Túi 0417",
        1,
        [new ProductionReportMonth(2026, 7, "2026-07"), new ProductionReportMonth(2026, 8, "2026-08")],
        [new ProductionMonthlyOperationSummary(
            Guid.NewGuid(),
            9,
            "May thân",
            "cái",
            [
                new ProductionOperationMonthSummary("2026-07", 100m, 20m, 120m, 0m, 120m),
                new ProductionOperationMonthSummary("2026-08", 40m, 10m, 50m, 30m, 80m)
            ],
            140m,
            30m,
            170m,
            30m,
            200m)]);

    private static string[] Cells(Row row) => row.Elements<Cell>().Select(cell => cell.InnerText).ToArray();
    private static Cell Cell(Row row, string reference) => row.Elements<Cell>().Single(cell => cell.CellReference?.Value == reference);
}
