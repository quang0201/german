using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Validation;
using German.Application.Attendance;
using German.Domain.Attendance;
using German.Infrastructure.Excel;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Infrastructure.Tests.Excel;

[TestClass]
public sealed class OpenXmlAttendanceExporterTests
{
    [TestMethod]
    public void Export_CreatesOneDynamicAttendanceSheetWithHiddenEmployeeCodeAndFreeze()
    {
        using var document = OpenWorkbook(CreateData(2026, 8));
        var sheets = GetSheets(document);
        CollectionAssert.AreEqual(new[] { "Bảng chấm công" }, sheets.Select(x => x.Name!.Value).ToArray());

        var worksheet = GetWorksheetPart(document).Worksheet!;
        var column = worksheet.GetFirstChild<Columns>()!.Elements<Column>().Single(x => x.Min!.Value == 2U);
        Assert.IsTrue(column.Hidden!.Value);

        var pane = worksheet.GetFirstChild<SheetViews>()!.GetFirstChild<SheetView>()!.GetFirstChild<Pane>();
        Assert.IsNotNull(pane);
        Assert.AreEqual(4D, pane.HorizontalSplit!.Value);
        Assert.AreEqual(5D, pane.VerticalSplit!.Value);
        Assert.AreEqual("E6", pane.TopLeftCell!.Value);

        var data = GetSheetData(document);
        Assert.AreEqual("BẢNG CHẤM CÔNG THÁNG 08/2026", GetCell(data, "A1").InnerText);
        CollectionAssert.AreEqual(new[] { "STT", "Mã NV", "Họ và tên", "Ca", "T7", "CN", "T2" },
            GetRow(data, 4).Elements<Cell>().Take(7).Select(x => x.InnerText).ToArray());
        CollectionAssert.AreEqual(new[] { "1", "2", "3" },
            GetRow(data, 5).Elements<Cell>().Take(3).Select(x => x.InnerText).ToArray());
        Assert.AreEqual("Ca 1", GetCell(data, "D6").InnerText);
        Assert.AreEqual("Ca 2", GetCell(data, "D7").InnerText);
        Assert.AreEqual("TC", GetCell(data, "D8").InnerText);
        Assert.AreEqual("4", GetCell(data, "E6").CellValue!.Text);
        Assert.AreEqual("P", GetCell(data, "E7").InnerText);
        Assert.AreEqual("2", GetCell(data, "E8").CellValue!.Text);
        Assert.AreEqual("Ô", GetCell(data, "F6").InnerText);
        Assert.IsNull(GetCell(data, "F8").CellValue);
        Assert.IsTrue(data.Descendants<Cell>().All(cell => cell.CellFormula is null));
    }

    [TestMethod]
    public void Export_PrioritizesTcStyleAndWeekendStylesRemainDistinct()
    {
        using var document = OpenWorkbook(CreateData(2026, 8));
        var data = GetSheetData(document);
        Assert.AreEqual("FFE2F0D9", GetFillColor(document, GetCell(data, "E8")));
        Assert.AreEqual("FFE2F0D9", GetFillColor(document, GetCell(data, "F8")));
        Assert.AreEqual("FFF0F7FC", GetFillColor(document, GetCell(data, "E6")));
        Assert.AreEqual("FFFDECEC", GetFillColor(document, GetCell(data, "F6")));
        Assert.AreEqual("FF1F6B3A", GetFontColor(document, GetCell(data, "E8")));
        var borderId = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!.Elements<CellFormat>().ElementAt((int)GetCell(data, "E8").StyleIndex!.Value).BorderId!.Value;
        Assert.AreEqual(2U, borderId);
    }

    [DataTestMethod]
    [DataRow(2026, 2, 28)]
    [DataRow(2028, 2, 29)]
    [DataRow(2026, 8, 31)]
    public void Export_UsesExactMonthDayCount(int year, int month, int expectedDays)
    {
        using var document = OpenWorkbook(new AttendanceExportData(year, month, []));
        var row = GetRow(GetSheetData(document), 4);
        Assert.AreEqual(4 + expectedDays + 5, row.Elements<Cell>().Count());
    }

    [TestMethod]
    public void Export_PassesOpenXmlValidation()
    {
        using var document = OpenWorkbook(CreateData(2026, 8));
        var errors = new OpenXmlValidator().Validate(document).ToList();
        Assert.AreEqual(0, errors.Count, string.Join(Environment.NewLine, errors.Select(error => error.Description)));
    }

    [TestMethod]
    public void Export_RendersAnEmptySavedDaySetAsOneTcRowWithoutInvalidSelfMerges()
    {
        using var document = OpenWorkbook(new AttendanceExportData(2026, 8, [new AttendanceExportEmployee(
            Guid.NewGuid(), "A003", "Chưa nhập", [], AttendanceTotalsDto.Empty)]));
        var data = GetSheetData(document);
        Assert.AreEqual("TC", GetCell(data, "D6").InnerText);
        Assert.AreEqual(0, GetWorksheetPart(document).Worksheet!.GetFirstChild<MergeCells>()!.Elements<MergeCell>().Count(merge => merge.Reference!.Value!.Contains("6:6", StringComparison.Ordinal)));
    }

    private static AttendanceExportData CreateData(int year, int month) => new(
        year,
        month,
        [new AttendanceExportEmployee(
            Guid.NewGuid(),
            "A001",
            "Nguyễn Văn A",
            [
                new AttendanceExportDay(new DateOnly(year, month, 1), 2m, "Ghi chú", [
                    new AttendanceExportShift(1, 4m, AttendanceShiftValueKind.Hours, 4m),
                    new AttendanceExportShift(2, 4m, AttendanceShiftValueKind.PaidLeave, null)
                ]),
                new AttendanceExportDay(new DateOnly(year, month, 2), 0m, "", [
                    new AttendanceExportShift(1, 4m, AttendanceShiftValueKind.SickLeave, null)
                ])
            ],
            new AttendanceTotalsDto(4m, 2m, 4m, 4m))]);

    private static SpreadsheetDocument OpenWorkbook(AttendanceExportData data)
    {
        var bytes = new OpenXmlAttendanceExporter().Export(data);
        Assert.IsTrue(bytes.Length > 0);
        return SpreadsheetDocument.Open(new MemoryStream(bytes), false);
    }

    private static List<Sheet> GetSheets(SpreadsheetDocument document) => document.WorkbookPart!.Workbook!.Sheets!.Elements<Sheet>().ToList();
    private static WorksheetPart GetWorksheetPart(SpreadsheetDocument document) => (WorksheetPart)document.WorkbookPart!.GetPartById(GetSheets(document).Single().Id!.Value!);
    private static SheetData GetSheetData(SpreadsheetDocument document) => GetWorksheetPart(document).Worksheet!.GetFirstChild<SheetData>()!;
    private static Row GetRow(SheetData data, uint row) => data.Elements<Row>().Single(x => x.RowIndex!.Value == row);
    private static Cell GetCell(SheetData data, string reference) => data.Descendants<Cell>().Single(x => x.CellReference!.Value == reference);
    private static string GetFillColor(SpreadsheetDocument document, Cell cell)
    {
        var format = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!.Elements<CellFormat>().ElementAt((int)cell.StyleIndex!.Value);
        return document.WorkbookPart.WorkbookStylesPart.Stylesheet.Fills!.Elements<Fill>().ElementAt((int)(format.FillId?.Value ?? 0U)).PatternFill!.ForegroundColor!.Rgb!.Value!;
    }
    private static string GetFontColor(SpreadsheetDocument document, Cell cell)
    {
        var format = document.WorkbookPart!.WorkbookStylesPart!.Stylesheet!.CellFormats!.Elements<CellFormat>().ElementAt((int)cell.StyleIndex!.Value);
        return document.WorkbookPart.WorkbookStylesPart.Stylesheet.Fonts!.Elements<Font>().ElementAt((int)(format.FontId?.Value ?? 0U)).Color!.Rgb!.Value!;
    }
}
