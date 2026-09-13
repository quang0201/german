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
    public void Export_CreatesOneCombinedSheetAndActivatesIt()
    {
        using var document = OpenWorkbook(CreateReport());
        var sheets = GetSheets(document);
        CollectionAssert.AreEqual(new[] { "Báo cáo quản lý" }, sheets.Select(sheet => sheet.Name!.Value).ToArray());
        Assert.AreEqual(0U, document.WorkbookPart!.Workbook!.BookViews!.Elements<WorkbookView>().Single().ActiveTab?.Value);
    }

    [TestMethod]
    public void Export_CombinedSheetFreezesEmployeeColumnsAndHeaderRows()
    {
        using var document = OpenWorkbook(CreateReport());
        var pane = GetWorksheetPart(document, "Báo cáo quản lý").Worksheet!.GetFirstChild<SheetViews>()?.GetFirstChild<SheetView>()?.GetFirstChild<Pane>();
        Assert.IsNotNull(pane);
        Assert.AreEqual(PaneStateValues.Frozen, pane.State?.Value);
        Assert.AreEqual(3D, pane.HorizontalSplit?.Value);
        Assert.AreEqual(5D, pane.VerticalSplit?.Value);
        Assert.AreEqual("D6", pane.TopLeftCell?.Value);
    }

    [TestMethod]
    public void Export_UsesDistinctHcAndTcColorsForTheDailyMatrix()
    {
        using var document = OpenWorkbook(CreateReport());
        var rows = GetSheetData(document, "Báo cáo quản lý").Elements<Row>().ToList();
        var header = rows.Single(row => row.RowIndex!.Value == 5U);
        var firstDataRow = rows.Single(row => row.RowIndex!.Value == 6U);

        Assert.AreEqual("FF9DC3E6", GetFillColor(document, GetCell(header, "E5")));
        Assert.AreEqual("FFF4B183", GetFillColor(document, GetCell(header, "F5")));
        Assert.AreEqual("FFEAF4FB", GetFillColor(document, GetCell(firstDataRow, "E6")));
        Assert.AreEqual("FFFFE6CC", GetFillColor(document, GetCell(firstDataRow, "F6")));
    }

    [TestMethod]
    public void Export_RemovesLegacyOverallAndDetailedSections()
    {
        using var document = OpenWorkbook(CreateReport());
        var rows = GetSheetData(document, "Báo cáo quản lý").Elements<Row>().ToList();
        Assert.IsFalse(rows.Any(row => GetCells(row).Any(cell => cell.InnerText == "BÁO CÁO SẢN LƯỢNG")));
        Assert.IsFalse(GetSheetData(document, "Báo cáo quản lý").InnerText.Contains("MÃ SX:", StringComparison.Ordinal));
        var title = rows.First();
        var titleIndex = title.RowIndex!.Value;
        CollectionAssert.AreEqual(new[] { "TỔNG HỢP SẢN LƯỢNG VÀ GIỜ LÀM THEO NGÀY" }, GetCells(title).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(new[] { "Kỳ: 12/08/2026 – 15/08/2026" }, GetCells(rows.Single(row => row.RowIndex!.Value == titleIndex + 1U)).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(new[] { "Nhân viên", "CĐ", "ĐVT", "T4 12/08/2026", "T5 13/08/2026", "T6 14/08/2026", "T7 15/08/2026", "Tổng kỳ" }, GetCells(rows.Single(row => row.RowIndex!.Value == titleIndex + 3U)).Select(cell => cell.InnerText).ToArray());
    }

    [TestMethod]
    public void Export_EmptyRowsStillCreatesValidOneSheetWorkbook()
    {
        var report = new ProductionReportData(new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 12), Array.Empty<ProductionReportRow>())
        {
            Summary = new ProductionReportSummary(0, 0, 0m, 0m, 0m), ByDay = [], ByEmployee = []
        };
        using var document = OpenWorkbook(report);
        Assert.AreEqual(1, GetSheets(document).Count);
        StringAssert.Contains(GetSheetData(document, "Báo cáo quản lý").InnerText, "Không có dữ liệu trong kỳ đã chọn.");
    }

    [TestMethod]
    public void Export_CombinesEmployeeProductionAndWorkHoursHorizontallyByDay()
    {
        var report = CreateReport() with
        {
            ByOrderAndDay =
            [
                new ProductionReportOrderDaySummary(new DateOnly(2026, 8, 12), "0417", "Túi 0417", 150m, 25m, 175m),
                new ProductionReportOrderDaySummary(new DateOnly(2026, 8, 13), "0417", "Túi 0417", 80m, 10m, 90m)
            ],
            WorkHours =
            [
                new ProductionReportWorkHourSummary(new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", 8m, 2m, 0m, 0m, "Ca chiều"),
                new ProductionReportWorkHourSummary(new DateOnly(2026, 8, 13), "E001", "Nguyễn Văn A", 7.5m, 0m, 0m, 0m, "")
            ],
            ByEmployeeAndDay =
            [
                new ProductionReportEmployeeDaySummary(new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", 180m, 29m, 209m),
                new ProductionReportEmployeeDaySummary(new DateOnly(2026, 8, 13), "E001", "Nguyễn Văn A", 80m, 10m, 90m)
            ]
        };

        using var document = OpenWorkbook(report);
        CollectionAssert.AreEqual(new[] { "Báo cáo quản lý" }, GetSheets(document).Select(sheet => sheet.Name!.Value).ToArray());

        var combinedRows = GetSheetData(document, "Báo cáo quản lý").Elements<Row>().ToList();
        var title = combinedRows.Single(row => GetCells(row).Any(cell => cell.InnerText == "TỔNG HỢP SẢN LƯỢNG VÀ GIỜ LÀM THEO NGÀY"));
        var titleIndex = title.RowIndex!.Value;
        CollectionAssert.AreEqual(
            new[] { "Nhân viên", "CĐ", "ĐVT", "T4 12/08/2026", "T5 13/08/2026", "T6 14/08/2026", "T7 15/08/2026", "Tổng kỳ" },
            GetCells(combinedRows.Single(row => row.RowIndex!.Value == titleIndex + 3U)).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Tổng SP", "HC SP", "TC SP", "Giờ HC", "Giờ TC", "Tổng giờ" }.Concat(
                new[] { "Tổng SP", "HC SP", "TC SP", "Giờ HC", "Giờ TC", "Tổng giờ" }).Concat(
                new[] { "Tổng SP", "HC SP", "TC SP", "Giờ HC", "Giờ TC", "Tổng giờ" }).Concat(
                new[] { "Tổng SP", "HC SP", "TC SP", "Giờ HC", "Giờ TC", "Tổng giờ" }).Concat(
                new[] { "Tổng SP", "HC SP", "TC SP", "Giờ HC", "Giờ TC", "Tổng giờ" }).ToArray(),
            GetCells(combinedRows.Single(row => row.RowIndex!.Value == titleIndex + 4U)).Select(cell => cell.InnerText).ToArray());

        var firstDataRow = GetCells(combinedRows.Single(row => row.RowIndex!.Value == titleIndex + 5U));
        Assert.AreEqual("E001 - Nguyễn Văn A", firstDataRow[0].InnerText);
        Assert.AreEqual("CĐ11, CĐ20", firstDataRow[1].InnerText);
        Assert.AreEqual("cái, thùng", firstDataRow[2].InnerText);
        CollectionAssert.AreEqual(new[] { "209", "180", "29", "8", "2", "10" }, firstDataRow.Skip(3).Take(6).Select(cell => cell.CellValue!.Text).ToArray());
        CollectionAssert.AreEqual(new[] { "90", "80", "10", "7.5", "0", "7.5" }, firstDataRow.Skip(9).Take(6).Select(cell => cell.CellValue!.Text).ToArray());
    }

    private static SpreadsheetDocument OpenWorkbook(ProductionReportData report)
    {
        var bytes = new OpenXmlProductionReportExporter().Export(report);
        Assert.IsTrue(bytes.Length > 0);
        return SpreadsheetDocument.Open(new MemoryStream(bytes), false);
    }

    private static List<Sheet> GetSheets(SpreadsheetDocument document)
    {
        var workbook = document.WorkbookPart?.Workbook ?? throw new AssertFailedException("Workbook root is missing.");
        return workbook.Sheets?.Elements<Sheet>().ToList() ?? throw new AssertFailedException("Workbook Sheets collection is missing.");
    }

    private static SheetData GetSheetData(SpreadsheetDocument document, string sheetName)
    {
        var worksheet = GetWorksheetPart(document, sheetName).Worksheet ?? throw new AssertFailedException("Worksheet root is missing.");
        return worksheet.GetFirstChild<SheetData>() ?? throw new AssertFailedException("Worksheet does not contain SheetData.");
    }

    private static WorksheetPart GetWorksheetPart(SpreadsheetDocument document, string sheetName)
    {
        var sheet = GetSheets(document).Single(sheet => sheet.Name?.Value == sheetName);
        var relationshipId = sheet.Id?.Value ?? throw new AssertFailedException("Worksheet relationship id is missing.");
        return (WorksheetPart)document.WorkbookPart!.GetPartById(relationshipId);
    }

    private static Cell[] GetCells(Row row) => row.Elements<Cell>().ToArray();
    private static Cell GetCell(Row row, string reference) => GetCellOrNull(row, reference) ?? throw new AssertFailedException($"Cell '{reference}' is missing.");
    private static Cell? GetCellOrNull(Row row, string reference) => row.Elements<Cell>().SingleOrDefault(cell => cell.CellReference?.Value == reference);

    private static void AssertDateFormat(SpreadsheetDocument document, Cell cell)
    {
        Assert.IsNull(cell.DataType);
        var formats = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!;
        var format = formats.Elements<CellFormat>().ElementAt((int)cell.StyleIndex!.Value);
        Assert.AreEqual(164U, format.NumberFormatId!.Value);
        Assert.AreEqual("dd/MM/yyyy", document.WorkbookPart.WorkbookStylesPart.Stylesheet.NumberingFormats!.Elements<NumberingFormat>().Single(numberFormat => numberFormat.NumberFormatId!.Value == 164U).FormatCode!.Value);
    }

    private static void AssertRightAligned(SpreadsheetDocument document, Cell cell)
    {
        var formats = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!;
        var format = formats.Elements<CellFormat>().ElementAt((int)cell.StyleIndex!.Value);
        Assert.AreEqual(HorizontalAlignmentValues.Right, format.Alignment?.Horizontal?.Value);
    }

    private static string? GetFillColor(SpreadsheetDocument document, Cell cell)
    {
        var formats = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!;
        var format = formats.Elements<CellFormat>().ElementAt((int)cell.StyleIndex!.Value);
        var fills = document.WorkbookPart.WorkbookStylesPart.Stylesheet.Fills!;
        var fill = fills.Elements<Fill>().ElementAt((int)(format.FillId?.Value ?? 0U));
        return fill.PatternFill?.ForegroundColor?.Rgb?.Value;
    }

    private static ProductionReportData CreateReport() => new(
        new DateOnly(2026, 8, 12),
        new DateOnly(2026, 8, 15),
        new[]
        {
            new ProductionReportRow(new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", "0417", "Túi 0417", 11, "May thân", "cái", 100m, 20m, 120m, 2m, ProductionEntryMode.Direct, "Ca chiều"),
            new ProductionReportRow(new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", "0417", "Túi 0417", 11, "May thân", "cái", 50m, 5m, 55m, null, ProductionEntryMode.Direct, null),
            new ProductionReportRow(new DateOnly(2026, 8, 13), "E001", "Nguyễn Văn A", "0417", "Túi 0417", 11, "May thân", "cái", 80m, 10m, 90m, null, ProductionEntryMode.Direct, null),
            new ProductionReportRow(new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", "0417", "Túi 0417", 20, "Đóng gói", "thùng", 30m, 4m, 34m, null, ProductionEntryMode.Direct, null),
            new ProductionReportRow(new DateOnly(2026, 8, 12), "E002", "Trần Thị B", "0417", "Túi 0417", 16, "Kiểm hàng", "cái", 200m, 0m, 200m, null, ProductionEntryMode.Direct, null),
            new ProductionReportRow(new DateOnly(2026, 8, 14), "E003", "Lê Văn C", "0520", "Sản phẩm 0520", 12, "May", "bộ", 7m, 3m, 10m, null, ProductionEntryMode.Direct, null)
        })
    {
        Summary = new ProductionReportSummary(3, 6, 467m, 42m, 509m),
        ByDay =
        [
            new ProductionReportDaySummary(new DateOnly(2026, 8, 12), 380m, 29m, 409m),
            new ProductionReportDaySummary(new DateOnly(2026, 8, 13), 80m, 10m, 90m),
            new ProductionReportDaySummary(new DateOnly(2026, 8, 14), 7m, 3m, 10m)
        ],
        ByEmployee =
        [
            new ProductionReportEmployeeSummary("E001", "Nguyễn Văn A", 260m, 39m, 299m),
            new ProductionReportEmployeeSummary("E002", "Trần Thị B", 200m, 0m, 200m),
            new ProductionReportEmployeeSummary("E003", "Lê Văn C", 7m, 3m, 10m)
        ],
        ByEmployeeAndDay =
        [
            new ProductionReportEmployeeDaySummary(new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", 150m, 25m, 175m),
            new ProductionReportEmployeeDaySummary(new DateOnly(2026, 8, 13), "E001", "Nguyễn Văn A", 80m, 10m, 90m),
            new ProductionReportEmployeeDaySummary(new DateOnly(2026, 8, 12), "E002", "Trần Thị B", 200m, 0m, 200m),
            new ProductionReportEmployeeDaySummary(new DateOnly(2026, 8, 14), "E003", "Lê Văn C", 7m, 3m, 10m)
        ],
        WorkHours =
        [
            new ProductionReportWorkHourSummary(new DateOnly(2026, 8, 12), "E001", "Nguyễn Văn A", 8m, 2m, 0m, 0m, "Ca chiều"),
            new ProductionReportWorkHourSummary(new DateOnly(2026, 8, 13), "E001", "Nguyễn Văn A", 8m, 0m, 0m, 0m, ""),
            new ProductionReportWorkHourSummary(new DateOnly(2026, 8, 12), "E002", "Trần Thị B", 8m, 0m, 0m, 0m, ""),
            new ProductionReportWorkHourSummary(new DateOnly(2026, 8, 14), "E003", "Lê Văn C", 8m, 1m, 0m, 0m, "")
        ]
    };
}
