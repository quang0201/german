using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;
using German.Domain.Production;
using German.Infrastructure.Excel;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Infrastructure.Tests.Excel;

[TestClass]
public sealed class OpenXmlProductionReportSundayTests
{
    [TestMethod]
    public void Export_ExcludeSundays_RemovesSundayAxisUsesWeekdayLabelsAndHasNoOperationSubtotal()
    {
        using var document = OpenWorkbook(CreateReport(excludeSundays: true));
        var sheetData = GetSheetData(document, "Báo cáo quản lý");
        var rows = sheetData.Elements<Row>().ToList();
        var header = rows.Single(row => row.RowIndex!.Value == 4U).Elements<Cell>().Select(cell => cell.InnerText).ToArray();

        CollectionAssert.AreEqual(
            new[] { "Nhân viên", "CĐ", "ĐVT", "T7 15/08/2026", "T2 17/08/2026", "Tổng HC", "Tổng TC", "Tổng" },
            header);
        StringAssert.DoesNotContain(sheetData.InnerText, "CN 16/08/2026");
        StringAssert.DoesNotContain(sheetData.InnerText, "TỔNG THEO CÔNG ĐOẠN");

        var productionRow = rows.Single(row => row.RowIndex!.Value == 6U);
        Assert.AreEqual("30", GetCell(productionRow, "H6").CellValue!.Text);
        Assert.AreEqual("5", GetCell(productionRow, "I6").CellValue!.Text);
        Assert.AreEqual("35", GetCell(productionRow, "J6").CellValue!.Text);
    }

    [TestMethod]
    public void Export_IncludeSundays_ShowsSundayHeaderEvenWithoutSundayEntry()
    {
        using var document = OpenWorkbook(CreateReport(excludeSundays: false));
        var headerText = string.Join(
            "|",
            GetSheetData(document, "Báo cáo quản lý")
                .Elements<Row>()
                .Single(row => row.RowIndex!.Value == 4U)
                .Elements<Cell>()
                .Select(cell => cell.InnerText));

        StringAssert.Contains(headerText, "T7 15/08/2026");
        StringAssert.Contains(headerText, "CN 16/08/2026");
        StringAssert.Contains(headerText, "T2 17/08/2026");
    }

    private static ProductionReportData CreateReport(bool excludeSundays) => new(
        new DateOnly(2026, 8, 15),
        new DateOnly(2026, 8, 17),
        new[]
        {
            Row(new DateOnly(2026, 8, 15), 10m, 2m),
            Row(new DateOnly(2026, 8, 17), 20m, 3m)
        })
    {
        ExcludeSundays = excludeSundays,
        Summary = new ProductionReportSummary(1, 2, 30m, 5m, 35m),
        ByDay =
        [
            new ProductionReportDaySummary(new DateOnly(2026, 8, 15), 10m, 2m, 12m),
            new ProductionReportDaySummary(new DateOnly(2026, 8, 17), 20m, 3m, 23m)
        ],
        ByEmployee =
        [
            new ProductionReportEmployeeSummary("E001", "Nguyễn Văn A", 30m, 5m, 35m)
        ]
    };

    private static ProductionReportRow Row(DateOnly date, decimal hc, decimal tc) => new(
        date,
        "E001",
        "Nguyễn Văn A",
        "0417",
        "Túi 0417",
        12,
        "May",
        "cái",
        hc,
        tc,
        hc + tc,
        null,
        ProductionEntryMode.Direct,
        null);

    private static SpreadsheetDocument OpenWorkbook(ProductionReportData report)
    {
        var bytes = new OpenXmlProductionReportExporter().Export(report);
        return SpreadsheetDocument.Open(new MemoryStream(bytes), false);
    }

    private static SheetData GetSheetData(SpreadsheetDocument document, string sheetName)
    {
        var workbookPart = document.WorkbookPart
            ?? throw new AssertFailedException("Workbook part is missing.");
        var workbook = workbookPart.Workbook
            ?? throw new AssertFailedException("Workbook root is missing.");
        var sheet = workbook.Sheets?.Elements<Sheet>()
            .SingleOrDefault(item => item.Name?.Value == sheetName)
            ?? throw new AssertFailedException($"Worksheet '{sheetName}' is missing.");
        var relationshipId = sheet.Id?.Value
            ?? throw new AssertFailedException($"Worksheet '{sheetName}' relationship is missing.");
        var worksheetPart = workbookPart.GetPartById(relationshipId) as WorksheetPart
            ?? throw new AssertFailedException($"Worksheet '{sheetName}' part is missing.");
        return worksheetPart.Worksheet.GetFirstChild<SheetData>()
            ?? throw new AssertFailedException("SheetData is missing.");
    }

    private static Cell GetCell(Row row, string reference) =>
        row.Elements<Cell>().SingleOrDefault(cell => cell.CellReference?.Value == reference)
        ?? throw new AssertFailedException($"Cell '{reference}' is missing.");
}
