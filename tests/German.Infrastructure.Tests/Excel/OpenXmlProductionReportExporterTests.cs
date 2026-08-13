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
    public void Export_CreatesOverviewAndDetailSheetsInOrder()
    {
        using var document = OpenWorkbook(CreateReport());
        var sheets = GetSheets(document);

        CollectionAssert.AreEqual(
            new[] { "Tổng quan", "Chi tiết" },
            sheets.Select(sheet => sheet.Name!.Value).ToArray());
    }

    [TestMethod]
    public void Export_WritesOverviewMetadataMetricsAndAggregateTotals()
    {
        using var document = OpenWorkbook(CreateReport());
        var rows = GetSheetData(document, "Tổng quan").Elements<Row>().ToList();

        CollectionAssert.AreEqual(
            new[] { "BÁO CÁO SẢN LƯỢNG" },
            GetCells(rows[0]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Kỳ báo cáo", "46246", "đến", "46246" },
            GetCells(rows[2]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Nhân viên", "Nguyễn Văn A", "Mã sản xuất", "0417 - Túi 0417" },
            GetCells(rows[3]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Công đoạn", "May thân", "Tìm kiếm", "may thân" },
            GetCells(rows[4]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Nhân viên", "Bản ghi", "HC", "TC", "Tổng sản lượng" },
            GetCells(rows[6]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "1", "1", "100", "20", "120" },
            GetCells(rows[7]).Select(cell => cell.InnerText).ToArray());

        CollectionAssert.AreEqual(
            new[] { "Ngày", "HC", "TC", "Tổng" },
            GetCells(rows[10]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "TỔNG", "100", "20", "120" },
            GetCells(rows[12]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Mã NV", "Họ tên", "HC", "TC", "Tổng" },
            GetCells(rows[15]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "TỔNG", "", "100", "20", "120" },
            GetCells(rows[17]).Select(cell => cell.InnerText).ToArray());
    }

    [TestMethod]
    public void Export_WritesDetailHeadersAndExcelUsabilityFeatures()
    {
        using var document = OpenWorkbook(CreateReport());
        var worksheetPart = GetWorksheetPart(document, "Chi tiết");
        var worksheet = worksheetPart.Worksheet!;
        var rows = GetSheetData(document, "Chi tiết").Elements<Row>().ToList();

        var expectedHeaders = new[]
        {
            "Ngày", "Mã NV", "Họ tên", "Mã SX", "Sản phẩm", "Công đoạn", "Đơn vị",
            "HC", "TC", "Tổng", "Giờ TC", "Kiểu nhập", "Ghi chú"
        };
        CollectionAssert.AreEqual(expectedHeaders, GetCells(rows[0]).Select(cell => cell.InnerText).ToArray());

        var pane = worksheet.GetFirstChild<SheetViews>()?.GetFirstChild<SheetView>()?.GetFirstChild<Pane>();
        Assert.IsNotNull(pane);
        Assert.AreEqual(PaneStateValues.Frozen, pane.State?.Value);
        Assert.AreEqual(1D, pane.VerticalSplit?.Value);
        Assert.AreEqual("A2", pane.TopLeftCell?.Value);
        Assert.AreEqual("A1:M2", worksheet.GetFirstChild<AutoFilter>()?.Reference?.Value);
        Assert.IsNull(worksheet.GetFirstChild<MergeCells>());

        var columns = worksheet.GetFirstChild<Columns>()?.Elements<Column>().ToArray();
        Assert.IsNotNull(columns);
        CollectionAssert.AreEqual(
            new[] { 12D, 12D, 24D, 14D, 24D, 28D, 12D, 12D, 12D, 12D, 12D, 18D, 30D },
            columns.Select(column => column.Width!.Value).ToArray());
        Assert.IsTrue(columns.All(column => column.CustomWidth?.Value == true));

        var cells = GetCells(rows[1]);
        AssertDateFormat(document, cells[0]);
        Assert.AreEqual("CĐ11 — May thân", cells[5].InnerText);
        Assert.AreEqual("HC / TC trực tiếp", cells[11].InnerText);
        foreach (var index in new[] { 7, 8, 9, 10 })
        {
            var dataType = cells[index].DataType?.Value;
            Assert.IsTrue(dataType is null || dataType == CellValues.Number);
            AssertRightAligned(document, cells[index]);
        }
        Assert.AreEqual("100", cells[7].CellValue?.Text);
        Assert.AreEqual("20", cells[8].CellValue?.Text);
        Assert.AreEqual("120", cells[9].CellValue?.Text);
        Assert.AreEqual("2", cells[10].CellValue?.Text);
    }

    [TestMethod]
    public void Export_EmptyRowsStillCreatesValidTwoSheetWorkbook()
    {
        var report = new ProductionReportData(
            new DateOnly(2026, 8, 12),
            new DateOnly(2026, 8, 12),
            Array.Empty<ProductionReportRow>())
        {
            Summary = new ProductionReportSummary(0, 0, 0m, 0m, 0m),
            ByDay = [],
            ByEmployee = []
        };

        using var document = OpenWorkbook(report);
        Assert.AreEqual(2, GetSheets(document).Count);

        var detailWorksheet = GetWorksheetPart(document, "Chi tiết").Worksheet!;
        Assert.AreEqual(1, GetSheetData(document, "Chi tiết").Elements<Row>().Count());
        Assert.AreEqual("A1:M1", detailWorksheet.GetFirstChild<AutoFilter>()?.Reference?.Value);
    }

    private static SpreadsheetDocument OpenWorkbook(ProductionReportData report)
    {
        var bytes = new OpenXmlProductionReportExporter().Export(report);
        Assert.IsTrue(bytes.Length > 0);
        return SpreadsheetDocument.Open(new MemoryStream(bytes), false);
    }

    private static List<Sheet> GetSheets(SpreadsheetDocument document)
    {
        var workbook = document.WorkbookPart?.Workbook
            ?? throw new AssertFailedException("Workbook root is missing.");
        return workbook.Sheets?.Elements<Sheet>().ToList()
            ?? throw new AssertFailedException("Workbook Sheets collection is missing.");
    }

    private static SheetData GetSheetData(SpreadsheetDocument document, string sheetName)
    {
        var worksheet = GetWorksheetPart(document, sheetName).Worksheet
            ?? throw new AssertFailedException("Worksheet root is missing.");
        return worksheet.GetFirstChild<SheetData>()
            ?? throw new AssertFailedException("Worksheet does not contain SheetData.");
    }

    private static WorksheetPart GetWorksheetPart(SpreadsheetDocument document, string sheetName)
    {
        var sheet = GetSheets(document).Single(sheet => sheet.Name?.Value == sheetName);
        var relationshipId = sheet.Id?.Value
            ?? throw new AssertFailedException("Worksheet relationship id is missing.");
        return (WorksheetPart)document.WorkbookPart!.GetPartById(relationshipId);
    }

    private static Cell[] GetCells(Row row) => row.Elements<Cell>().ToArray();

    private static void AssertDateFormat(SpreadsheetDocument document, Cell cell)
    {
        Assert.IsNull(cell.DataType);
        var formats = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!;
        var format = formats.Elements<CellFormat>().ElementAt((int)cell.StyleIndex!.Value);
        Assert.AreEqual(164U, format.NumberFormatId!.Value);
        Assert.AreEqual("dd/MM/yyyy", document.WorkbookPart.WorkbookStylesPart.Stylesheet.NumberingFormats!
            .Elements<NumberingFormat>().Single(numberFormat => numberFormat.NumberFormatId!.Value == 164U).FormatCode!.Value);
    }

    private static void AssertRightAligned(SpreadsheetDocument document, Cell cell)
    {
        var formats = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!;
        var format = formats.Elements<CellFormat>().ElementAt((int)cell.StyleIndex!.Value);
        Assert.AreEqual(HorizontalAlignmentValues.Right, format.Alignment?.Horizontal?.Value);
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
        })
    {
        EmployeeLabel = "Nguyễn Văn A",
        OrderLabel = "0417 - Túi 0417",
        OperationLabel = "May thân",
        SearchLabel = "may thân",
        FinalMetricLabel = "Tổng sản lượng",
        Summary = new ProductionReportSummary(1, 1, 100m, 20m, 120m),
        ByDay = [new ProductionReportDaySummary(new DateOnly(2026, 8, 12), 100m, 20m, 120m)],
        ByEmployee = [new ProductionReportEmployeeSummary("E001", "Nguyễn Văn A", 100m, 20m, 120m)]
    };
}
