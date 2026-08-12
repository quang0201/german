using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;
using German.Domain.Production;
using German.Infrastructure.Excel;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Infrastructure.Tests.Excel;

[TestClass]
public sealed class OpenXmlProductionReportExporterTests
{
    [TestMethod]
    public void Export_CreatesWorkbookWithProductionSheetAndHeaders()
    {
        var exporter = new OpenXmlProductionReportExporter();
        var bytes = exporter.Export(CreateReport());

        using var stream = new MemoryStream(bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheetData = GetSheetData(document);
        var rows = sheetData.Elements<Row>().ToList();

        var expectedHeaders = new[]
        {
            "Ngày", "Mã NV", "Họ tên", "Mã SX", "Sản phẩm", "CĐ", "Tên công đoạn",
            "Đơn vị", "HC", "TC", "Tổng", "Giờ TC", "Kiểu nhập", "Ghi chú"
        };
        CollectionAssert.AreEqual(expectedHeaders, rows[0].Elements<Cell>().Select(x => x.InnerText).ToArray());
    }

    [TestMethod]
    public void Export_WritesQuantitiesAsNumericCells()
    {
        var exporter = new OpenXmlProductionReportExporter();
        var bytes = exporter.Export(CreateReport());

        using var stream = new MemoryStream(bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheetData = GetSheetData(document);
        var dataRow = sheetData.Elements<Row>().Skip(1).Single();
        var cells = dataRow.Elements<Cell>().ToArray();

        foreach (var index in new[] { 8, 9, 10, 11 })
        {
            var dataType = cells[index].DataType?.Value;
            Assert.IsTrue(dataType is null || dataType == CellValues.Number);
        }
        Assert.AreEqual("100", cells[8].CellValue?.Text);
        Assert.AreEqual("20", cells[9].CellValue?.Text);
        Assert.AreEqual("120", cells[10].CellValue?.Text);
        Assert.AreEqual("2", cells[11].CellValue?.Text);
    }

    [TestMethod]
    public void Export_EmptyRowsStillCreatesValidWorkbook()
    {
        var exporter = new OpenXmlProductionReportExporter();
        var bytes = exporter.Export(new ProductionReportData(
            new DateOnly(2026, 8, 12),
            new DateOnly(2026, 8, 12),
            Array.Empty<ProductionReportRow>()));

        Assert.IsTrue(bytes.Length > 0);
        using var stream = new MemoryStream(bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheetData = GetSheetData(document);
        Assert.AreEqual(1, sheetData.Elements<Row>().Count());
    }

    private static SheetData GetSheetData(SpreadsheetDocument document)
    {
        var worksheetPart = GetProductionWorksheet(document);
        var worksheet = worksheetPart.Worksheet
            ?? throw new AssertFailedException("Worksheet root is missing.");
        return worksheet.GetFirstChild<SheetData>()
            ?? throw new AssertFailedException("Worksheet does not contain SheetData.");
    }

    private static WorksheetPart GetProductionWorksheet(SpreadsheetDocument document)
    {
        var workbookPart = document.WorkbookPart
            ?? throw new AssertFailedException("WorkbookPart is missing.");
        var workbook = workbookPart.Workbook
            ?? throw new AssertFailedException("Workbook root is missing.");
        var sheets = workbook.Sheets
            ?? throw new AssertFailedException("Workbook Sheets collection is missing.");
        var sheet = sheets.Elements<Sheet>().Single(x => x.Name?.Value == "Sản lượng");
        var relationshipId = sheet.Id?.Value
            ?? throw new AssertFailedException("Production sheet relationship id is missing.");
        return (WorksheetPart)workbookPart.GetPartById(relationshipId);
    }

    private static ProductionReportData CreateReport() => new(
        new DateOnly(2026, 8, 12),
        new DateOnly(2026, 8, 12),
        new[]
        {
            new ProductionReportRow(
                new DateOnly(2026, 8, 12),
                "E001",
                "Nguyễn Văn A",
                "0417",
                "Túi 0417",
                11,
                "May thân",
                "cái",
                100m,
                20m,
                120m,
                2m,
                ProductionEntryMode.Direct,
                "Ca chiều")
        });
}
