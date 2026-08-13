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
    public void Export_CreatesManagementOverviewAndDetailSheetsInOrderAndActivatesManagementSheet()
    {
        using var document = OpenWorkbook(CreateReport());
        var sheets = GetSheets(document);

        CollectionAssert.AreEqual(
            new[] { "Báo cáo quản lý", "Tổng quan", "Chi tiết" },
            sheets.Select(sheet => sheet.Name!.Value).ToArray());
        Assert.AreEqual(0U, document.WorkbookPart!.Workbook!.BookViews!.Elements<WorkbookView>().Single().ActiveTab?.Value);
    }

    [TestMethod]
    public void Export_WritesManagementBlocksWithHorizontalDatePivotAndTotals()
    {
        using var document = OpenWorkbook(CreateReport());
        var worksheetPart = GetWorksheetPart(document, "Báo cáo quản lý");
        var worksheet = worksheetPart.Worksheet!;
        var rows = GetSheetData(document, "Báo cáo quản lý").Elements<Row>().ToList();

        CollectionAssert.AreEqual(
            new[] { "MÃ SX: 0417 — Túi 0417" },
            GetCells(rows[0]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Kỳ: 12/08/2026 – 15/08/2026" },
            GetCells(rows[2]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Nhân viên", "CĐ", "ĐVT", "12/08/2026", "13/08/2026", "14/08/2026", "15/08/2026", "Tổng HC", "Tổng TC", "Tổng" },
            GetCells(rows[3]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "HC", "TC", "HC", "TC", "HC", "TC", "HC", "TC" },
            GetCells(rows[4]).Select(cell => cell.InnerText).ToArray());

        var firstRow = rows.Single(row => row.RowIndex!.Value == 6U);
        Assert.AreEqual("E001", GetCell(firstRow, "A6").InnerText);
        Assert.AreEqual("CĐ11", GetCell(firstRow, "B6").InnerText);
        Assert.AreEqual("cái", GetCell(firstRow, "C6").InnerText);
        Assert.AreEqual("150", GetCell(firstRow, "D6").CellValue!.Text);
        Assert.AreEqual("25", GetCell(firstRow, "E6").CellValue!.Text);
        Assert.IsNull(GetCellOrNull(firstRow, "F6"));
        Assert.AreEqual("80", GetCell(firstRow, "G6").CellValue!.Text);
        Assert.AreEqual("10", GetCell(firstRow, "H6").CellValue!.Text);
        Assert.AreEqual("230", GetCell(firstRow, "L6").CellValue!.Text);
        Assert.AreEqual("35", GetCell(firstRow, "M6").CellValue!.Text);
        Assert.AreEqual("265", GetCell(firstRow, "N6").CellValue!.Text);

        var secondEmployeeOperationRow = rows.Single(row => row.RowIndex!.Value == 8U);
        Assert.IsNull(GetCellOrNull(secondEmployeeOperationRow, "A8"));
        Assert.AreEqual("CĐ20", GetCell(secondEmployeeOperationRow, "B8").InnerText);
        Assert.AreEqual("thùng", GetCell(secondEmployeeOperationRow, "C8").InnerText);

        var secondBlockTitle = rows.Single(row => row.RowIndex!.Value == 17U);
        Assert.AreEqual("MÃ SX: 0520 — Sản phẩm 0520", GetCells(secondBlockTitle).Single().InnerText);
        Assert.IsNull(worksheet.GetFirstChild<AutoFilter>());
    }

    [TestMethod]
    public void Export_ManagementSheetFreezesThreeColumnsAndHeaderRows()
    {
        using var document = OpenWorkbook(CreateReport());
        var worksheet = GetWorksheetPart(document, "Báo cáo quản lý").Worksheet!;
        var pane = worksheet.GetFirstChild<SheetViews>()?.GetFirstChild<SheetView>()?.GetFirstChild<Pane>();

        Assert.IsNotNull(pane);
        Assert.AreEqual(PaneStateValues.Frozen, pane.State?.Value);
        Assert.AreEqual(3D, pane.VerticalSplit?.Value);
        Assert.AreEqual(5D, pane.HorizontalSplit?.Value);
        Assert.AreEqual("D6", pane.TopLeftCell?.Value);
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
            new[] { "Kỳ báo cáo", "46246", "đến", "46249" },
            GetCells(rows[2]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Nhân viên", "Tất cả", "Mã sản xuất", "Tất cả" },
            GetCells(rows[3]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "Công đoạn", "Tất cả", "Tìm kiếm", "Tất cả" },
            GetCells(rows[4]).Select(cell => cell.InnerText).ToArray());

        CollectionAssert.AreEqual(
            new[] { "Nhân viên", "Bản ghi", "HC", "TC", "Tổng lượt công đoạn" },
            GetCells(rows[6]).Select(cell => cell.InnerText).ToArray());
        CollectionAssert.AreEqual(
            new[] { "3", "5", "537", "39", "576" },
            GetCells(rows[7]).Select(cell => cell.InnerText).ToArray());
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
        Assert.AreEqual("A1:M7", worksheet.GetFirstChild<AutoFilter>()?.Reference?.Value);
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
        Assert.AreEqual(3, GetSheets(document).Count);

        var managementText = GetSheetData(document, "Báo cáo quản lý").InnerText;
        StringAssert.Contains(managementText, "Không có dữ liệu trong kỳ đã chọn.");

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

    private static Cell GetCell(Row row, string reference) =>
        GetCellOrNull(row, reference)
        ?? throw new AssertFailedException($"Cell '{reference}' is missing.");

    private static Cell? GetCellOrNull(Row row, string reference) =>
        row.Elements<Cell>().SingleOrDefault(cell => cell.CellReference?.Value == reference);

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
        new DateOnly(2026, 8, 15),
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
                "Ca chiều"),
            new ProductionReportRow(
                new DateOnly(2026, 8, 12),
                "E001",
                "Nguyễn Văn A",
                "0417",
                "Túi 0417",
                11,
                "May thân",
                "cái",
                50m,
                5m,
                55m,
                null,
                ProductionEntryMode.Direct,
                null),
            new ProductionReportRow(
                new DateOnly(2026, 8, 13),
                "E001",
                "Nguyễn Văn A",
                "0417",
                "Túi 0417",
                11,
                "May thân",
                "cái",
                80m,
                10m,
                90m,
                null,
                ProductionEntryMode.Direct,
                null),
            new ProductionReportRow(
                new DateOnly(2026, 8, 12),
                "E001",
                "Nguyễn Văn A",
                "0417",
                "Túi 0417",
                20,
                "Đóng gói",
                "thùng",
                30m,
                4m,
                34m,
                null,
                ProductionEntryMode.Direct,
                null),
            new ProductionReportRow(
                new DateOnly(2026, 8, 12),
                "E002",
                "Trần Thị B",
                "0417",
                "Túi 0417",
                16,
                "Kiểm hàng",
                "cái",
                200m,
                0m,
                200m,
                null,
                ProductionEntryMode.Direct,
                null),
            new ProductionReportRow(
                new DateOnly(2026, 8, 14),
                "E003",
                "Lê Văn C",
                "0520",
                "Sản phẩm 0520",
                12,
                "May",
                "bộ",
                7m,
                3m,
                10m,
                null,
                ProductionEntryMode.Direct,
                null)
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
        ]
    };
}
