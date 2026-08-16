using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Attendance;
using German.Domain.Attendance;

namespace German.Infrastructure.Excel;

public sealed class OpenXmlAttendanceExporter : IAttendanceExcelExporter
{
    private const uint TitleStyle = 1U;
    private const uint SubtitleStyle = 2U;
    private const uint HeaderStyle = 3U;
    private const uint SaturdayHeaderStyle = 4U;
    private const uint SundayHeaderStyle = 5U;
    private const uint TotalHeaderStyle = 6U;
    private const uint BodyStyle = 7U;
    private const uint SaturdayBodyStyle = 8U;
    private const uint SundayBodyStyle = 9U;
    private const uint TcStyle = 10U;
    private const uint TcSaturdayStyle = 11U;
    private const uint TcSundayStyle = 12U;
    private const uint TotalStyle = 13U;
    private const uint NoteStyle = 14U;

    public byte[] Export(AttendanceExportData data)
    {
        var days = Days(data.Year, data.Month).ToArray();
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook))
        {
            var workbookPart = document.AddWorkbookPart();
            workbookPart.Workbook = new Workbook(new BookViews(new WorkbookView { ActiveTab = 0U }));
            var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet = CreateStylesheet();
            stylesPart.Stylesheet.Save();

            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            worksheetPart.Worksheet = CreateWorksheet(data, days);
            worksheetPart.Worksheet.Save();
            workbookPart.Workbook.AppendChild(new Sheets()).Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = 1U,
                Name = "Bảng chấm công"
            });
            workbookPart.Workbook.Save();
        }
        return stream.ToArray();
    }

    private static Worksheet CreateWorksheet(AttendanceExportData data, IReadOnlyList<DateOnly> days)
    {
        var totalStart = 5 + days.Count;
        var lastColumn = totalStart + 4;
        var sheetData = new SheetData();
        var merges = new MergeCells();
        AddRow(sheetData, 1, At("A1", Text($"BẢNG CHẤM CÔNG THÁNG {data.Month:00}/{data.Year}", TitleStyle)));
        merges.Append(new MergeCell { Reference = $"A1:{Col(lastColumn)}1" });
        AddRow(sheetData, 2, At("A2", Text("Quy ước: số giờ là số; P = nghỉ phép; Ô = nghỉ ốm; TC = tăng ca.", SubtitleStyle)));
        merges.Append(new MergeCell { Reference = $"A2:{Col(lastColumn)}2" });
        AddRow(sheetData, 3);
        AddHeader(sheetData, merges, days, totalStart);

        var row = 6U;
        var employeeNumber = 1;
        foreach (var employee in data.Employees)
        {
            var maxSlot = employee.Days
                .SelectMany(day => day.Shifts)
                .Select(shift => shift.SlotNumber)
                .DefaultIfEmpty(0)
                .Max();
            var rowCount = maxSlot + 1;
            var startRow = row;
            var endRow = row + (uint)rowCount - 1U;
            var byDate = employee.Days.ToDictionary(day => day.WorkDate);
            for (var rowIndex = 0; rowIndex < rowCount; rowIndex++)
            {
                var isTc = rowIndex == maxSlot;
                var slotNumber = rowIndex + 1;
                var cells = new List<Cell>();
                if (rowIndex == 0)
                {
                    cells.Add(At($"A{row}", Num(employeeNumber)));
                    cells.Add(At($"B{row}", Text(employee.EmployeeCode)));
                    cells.Add(At($"C{row}", Text(employee.FullName)));
                }
                cells.Add(At($"D{row}", Text(isTc ? "TC" : $"Ca {slotNumber}", isTc ? TcStyle : BodyStyle)));
                foreach (var (day, dayIndex) in days.Select((day, index) => (day, index)))
                {
                    byDate.TryGetValue(day, out var savedDay);
                    cells.Add(At($"{Col(5 + dayIndex)}{row}", isTc
                        ? ExportOvertime(savedDay, day)
                        : ExportShift(savedDay, slotNumber, day)));
                }
                if (rowIndex == 0)
                {
                    cells.Add(At($"{Col(totalStart)}{row}", Num(employee.Totals.RegularWorkedHours, TotalStyle)));
                    cells.Add(At($"{Col(totalStart + 1)}{row}", Num(employee.Totals.OvertimeHours, TotalStyle)));
                    cells.Add(At($"{Col(totalStart + 2)}{row}", Num(employee.Totals.PaidLeaveHours, TotalStyle)));
                    cells.Add(At($"{Col(totalStart + 3)}{row}", Num(employee.Totals.SickLeaveHours, TotalStyle)));
                    var note = string.Join("; ", employee.Days.Select(day => day.Note).Where(note => !string.IsNullOrWhiteSpace(note)).Distinct());
                    cells.Add(At($"{Col(totalStart + 4)}{row}", Text(note, NoteStyle)));
                }
                AddCells(sheetData, row, cells.ToArray());
                row++;
            }

            AppendMerge(merges, $"A{startRow}:A{endRow}");
            AppendMerge(merges, $"B{startRow}:B{endRow}");
            AppendMerge(merges, $"C{startRow}:C{endRow}");
            AppendMerge(merges, $"{Col(totalStart)}{startRow}:{Col(totalStart)}{endRow}");
            AppendMerge(merges, $"{Col(totalStart + 1)}{startRow}:{Col(totalStart + 1)}{endRow}");
            AppendMerge(merges, $"{Col(totalStart + 2)}{startRow}:{Col(totalStart + 2)}{endRow}");
            AppendMerge(merges, $"{Col(totalStart + 3)}{startRow}:{Col(totalStart + 3)}{endRow}");
            AppendMerge(merges, $"{Col(totalStart + 4)}{startRow}:{Col(totalStart + 4)}{endRow}");
            employeeNumber++;
        }

        return new Worksheet(
            new SheetProperties(new PageSetupProperties { FitToPage = true }),
            new SheetViews(new SheetView(new Pane
            {
                HorizontalSplit = 4D,
                VerticalSplit = 5D,
                TopLeftCell = "E6",
                ActivePane = PaneValues.BottomRight,
                State = PaneStateValues.Frozen
            }) { WorkbookViewId = 0U }),
            AttendanceColumns(days.Count, totalStart),
            sheetData,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static void AddHeader(SheetData data, MergeCells merges, IReadOnlyList<DateOnly> days, int totalStart)
    {
        AddCells(data, 4,
            At("A4", Text("STT", HeaderStyle)),
            At("B4", Text("Mã NV", HeaderStyle)),
            At("C4", Text("Họ và tên", HeaderStyle)),
            At("D4", Text("Ca", HeaderStyle)));
        foreach (var (day, index) in days.Select((day, index) => (day, index)))
        {
            var column = 5 + index;
            AddCells(data, 4, At($"{Col(column)}4", Text(Weekday(day), HeaderStyleFor(day))));
            AddCells(data, 5, At($"{Col(column)}5", Text(day.Day.ToString(CultureInfo.InvariantCulture), HeaderStyleFor(day))));
        }
        AddCells(data, 4,
            At($"{Col(totalStart)}4", Text("Tổng HC", TotalHeaderStyle)),
            At($"{Col(totalStart + 1)}4", Text("Tổng TC", TotalHeaderStyle)),
            At($"{Col(totalStart + 2)}4", Text("Giờ P", TotalHeaderStyle)),
            At($"{Col(totalStart + 3)}4", Text("Giờ Ô", TotalHeaderStyle)),
            At($"{Col(totalStart + 4)}4", Text("Ghi chú", TotalHeaderStyle)));
        merges.Append(
            new MergeCell { Reference = "A4:A5" },
            new MergeCell { Reference = "B4:B5" },
            new MergeCell { Reference = "C4:C5" },
            new MergeCell { Reference = "D4:D5" });
        for (var column = totalStart; column <= totalStart + 4; column++)
        {
            merges.Append(new MergeCell { Reference = $"{Col(column)}4:{Col(column)}5" });
        }
    }

    private static Cell ExportShift(AttendanceExportDay? day, int slotNumber, DateOnly date)
    {
        var style = BodyStyleFor(date);
        var shift = day?.Shifts.SingleOrDefault(item => item.SlotNumber == slotNumber);
        if (shift is null) return Blank(style);
        return shift.ValueKind switch
        {
            AttendanceShiftValueKind.Hours => Num(shift.WorkedHours ?? 0m, style),
            AttendanceShiftValueKind.PaidLeave => Text("P", style),
            AttendanceShiftValueKind.SickLeave => Text("Ô", style),
            _ => Blank(style)
        };
    }

    private static Cell ExportOvertime(AttendanceExportDay? day, DateOnly date)
        => day?.OvertimeHours > 0m ? Num(day.OvertimeHours, TcStyleFor(date)) : Blank(TcStyleFor(date));

    private static Columns AttendanceColumns(int days, int totalStart)
    {
        var columns = new Columns(
            Column(1, 7),
            new Column { Min = 2U, Max = 2U, Width = 12D, CustomWidth = true, Hidden = true },
            Column(3, 24),
            Column(4, 10));
        for (var index = 0; index < days; index++) columns.Append(Column((uint)(5 + index), 9));
        for (var index = totalStart; index < totalStart + 4; index++) columns.Append(Column((uint)index, 12));
        columns.Append(Column((uint)(totalStart + 4), 25));
        return columns;
    }

    private static uint HeaderStyleFor(DateOnly date) => date.DayOfWeek switch
    {
        DayOfWeek.Saturday => SaturdayHeaderStyle,
        DayOfWeek.Sunday => SundayHeaderStyle,
        _ => HeaderStyle
    };

    private static uint BodyStyleFor(DateOnly date) => date.DayOfWeek switch
    {
        DayOfWeek.Saturday => SaturdayBodyStyle,
        DayOfWeek.Sunday => SundayBodyStyle,
        _ => BodyStyle
    };

    private static uint TcStyleFor(DateOnly date) => date.DayOfWeek switch
    {
        DayOfWeek.Saturday => TcSaturdayStyle,
        DayOfWeek.Sunday => TcSundayStyle,
        _ => TcStyle
    };

    private static string Weekday(DateOnly date) => date.DayOfWeek switch
    {
        DayOfWeek.Monday => "T2",
        DayOfWeek.Tuesday => "T3",
        DayOfWeek.Wednesday => "T4",
        DayOfWeek.Thursday => "T5",
        DayOfWeek.Friday => "T6",
        DayOfWeek.Saturday => "T7",
        DayOfWeek.Sunday => "CN",
        _ => ""
    };

    private static IEnumerable<DateOnly> Days(int year, int month)
    {
        var from = new DateOnly(year, month, 1);
        var until = from.AddMonths(1).AddDays(-1);
        for (var date = from; date <= until; date = date.AddDays(1)) yield return date;
    }

    private static void AddRow(SheetData data, uint rowIndex, params Cell[] cells)
    {
        var row = new Row { RowIndex = rowIndex };
        row.Append(cells);
        data.Append(row);
    }

    private static void AddCells(SheetData data, uint rowIndex, params Cell[] cells)
    {
        var row = data.Elements<Row>().SingleOrDefault(item => item.RowIndex?.Value == rowIndex) ?? new Row { RowIndex = rowIndex };
        if (row.Parent is null) data.Append(row);
        row.Append(cells.OrderBy(cell => ColumnNumber(cell.CellReference?.Value)));
    }

    private static void AppendMerge(MergeCells merges, string reference)
    {
        var separator = reference.IndexOf(':');
        if (separator >= 0 && reference[..separator] == reference[(separator + 1)..]) return;
        merges.Append(new MergeCell { Reference = reference });
    }

    private static Cell At(string reference, Cell cell) { cell.CellReference = reference; return cell; }
    private static Cell Text(string value, uint style = 0U) => new() { DataType = CellValues.InlineString, StyleIndex = style, InlineString = new InlineString(new Text(value)) };
    private static Cell Num(decimal value, uint style = BodyStyle) => new() { StyleIndex = style, CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture)) };
    private static Cell Blank(uint style) => new() { StyleIndex = style };
    private static Column Column(uint index, double width) => new() { Min = index, Max = index, Width = width, CustomWidth = true };
    private static string Col(int value) { var result = string.Empty; while (value > 0) { value--; result = (char)('A' + value % 26) + result; value /= 26; } return result; }
    private static int ColumnNumber(string? reference) { if (string.IsNullOrEmpty(reference)) return int.MaxValue; var result = 0; foreach (var character in reference) { if (!char.IsLetter(character)) break; result = result * 26 + char.ToUpperInvariant(character) - 'A' + 1; } return result; }

    private static Stylesheet CreateStylesheet()
    {
        var fonts = new Fonts(
            new Font(),
            new Font(new Bold()),
            new Font(new Bold(), new FontSize { Val = 14D }),
            new Font(new Bold(), new Color { Rgb = "FF1F6B3A" })) { Count = 4U };
        var fills = new Fills(
            new Fill(new PatternFill { PatternType = PatternValues.None }),
            new Fill(new PatternFill { PatternType = PatternValues.Gray125 }),
            SolidFill("FFEAF4FB"),
            SolidFill("FFF0F7FC"),
            SolidFill("FFFDECEC"),
            SolidFill("FFE2F0D9"),
            SolidFill("FFD9EAF7"),
            SolidFill("FFF4CCCC")) { Count = 8U };
        var borders = new Borders(
            new Border(),
            GridBorder("FFD0D7DE", BorderStyleValues.Thin),
            GridBorder("FF6B7280", BorderStyleValues.Medium)) { Count = 3U };
        var formats = new CellFormats(
            new CellFormat(),
            Format(fontId: 2U, fillId: 2U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(fontId: 1U, fillId: 2U, borderId: 1U),
            Format(fontId: 1U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(fontId: 1U, fillId: 6U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(fontId: 1U, fillId: 7U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(fontId: 1U, fillId: 2U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(borderId: 1U, alignment: HorizontalAlignmentValues.Center),
            Format(fillId: 3U, borderId: 1U, alignment: HorizontalAlignmentValues.Center),
            Format(fillId: 4U, borderId: 1U, alignment: HorizontalAlignmentValues.Center),
            Format(fontId: 3U, fillId: 5U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(fontId: 3U, fillId: 5U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(fontId: 3U, fillId: 5U, borderId: 2U, alignment: HorizontalAlignmentValues.Center),
            Format(borderId: 1U, alignment: HorizontalAlignmentValues.Right),
            Format(borderId: 1U, alignment: HorizontalAlignmentValues.Left)) { Count = 15U };
        return new Stylesheet(
            new NumberingFormats(),
            fonts,
            fills,
            borders,
            new CellStyleFormats(new CellFormat()) { Count = 1U },
            formats);
    }

    private static Fill SolidFill(string rgb) => new(new PatternFill(new ForegroundColor { Rgb = rgb }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid });
    private static Border GridBorder(string rgb, BorderStyleValues style) => new(
        new LeftBorder { Style = style, Color = new Color { Rgb = rgb } },
        new RightBorder { Style = style, Color = new Color { Rgb = rgb } },
        new TopBorder { Style = style, Color = new Color { Rgb = rgb } },
        new BottomBorder { Style = style, Color = new Color { Rgb = rgb } });
    private static CellFormat Format(uint fontId = 0U, uint fillId = 0U, uint borderId = 0U, HorizontalAlignmentValues? alignment = null)
        => new() { FontId = fontId, FillId = fillId, BorderId = borderId, ApplyFont = fontId > 0, ApplyFill = fillId > 0, ApplyBorder = borderId > 0, ApplyAlignment = alignment.HasValue, Alignment = alignment.HasValue ? new Alignment { Horizontal = alignment.Value } : null };
}
