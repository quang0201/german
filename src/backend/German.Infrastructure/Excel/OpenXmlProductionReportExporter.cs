using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;
using German.Domain.Production;

namespace German.Infrastructure.Excel;

public sealed class OpenXmlProductionReportExporter : IProductionReportExporter
{
    private const uint DateStyle = 1U;
    private const uint TitleStyle = 2U;
    private const uint HeaderStyle = 3U;
    private const uint SectionStyle = 4U;
    private const uint NumericStyle = 5U;
    private const uint CenterStyle = 6U;

    private static readonly string[] DetailHeaders =
    [
        "Ngày", "Mã NV", "Họ tên", "Mã SX", "Sản phẩm", "Công đoạn", "Đơn vị",
        "HC", "TC", "Tổng", "Giờ TC", "Kiểu nhập", "Ghi chú"
    ];

    public byte[] Export(ProductionReportData report)
    {
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook))
        {
            var workbookPart = document.AddWorkbookPart();
            workbookPart.Workbook = new Workbook(new BookViews(new WorkbookView { ActiveTab = 0U }));
            var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet = CreateStylesheet();
            stylesPart.Stylesheet.Save();

            var managementPart = AddWorksheet(workbookPart, CreateManagementWorksheet(report));
            var overviewPart = AddWorksheet(workbookPart, CreateOverviewWorksheet(report));
            var detailPart = AddWorksheet(workbookPart, CreateDetailWorksheet(report));
            workbookPart.Workbook.AppendChild(new Sheets()).Append(
                Sheet(workbookPart, managementPart, 1U, "Báo cáo quản lý"),
                Sheet(workbookPart, overviewPart, 2U, "Tổng quan"),
                Sheet(workbookPart, detailPart, 3U, "Chi tiết"));
            workbookPart.Workbook.Save();
        }
        return stream.ToArray();
    }

    private static WorksheetPart AddWorksheet(WorkbookPart workbookPart, Worksheet worksheet)
    {
        var part = workbookPart.AddNewPart<WorksheetPart>();
        part.Worksheet = worksheet;
        part.Worksheet.Save();
        return part;
    }

    private static Sheet Sheet(WorkbookPart workbookPart, WorksheetPart part, uint id, string name) => new()
    {
        Id = workbookPart.GetIdOfPart(part),
        SheetId = id,
        Name = name
    };

    private static Worksheet CreateManagementWorksheet(ProductionReportData report)
    {
        var days = Dates(report.FromDate, report.UntilDate)
            .Where(date => !report.ExcludeSundays || date.DayOfWeek != DayOfWeek.Sunday)
            .ToArray();
        var totalStart = 4 + days.Length * 2;
        var data = new SheetData();
        var merges = new MergeCells();
        var row = 1U;

        if (report.Rows.Count == 0)
        {
            AddRow(data, row++, Text("BÁO CÁO QUẢN LÝ", TitleStyle));
            AddRow(data, row++, Text(string.Empty));
            AddRow(data, row, Text("Không có dữ liệu trong kỳ đã chọn.", SectionStyle));
        }
        else
        {
            var blocks = report.Rows
                .GroupBy(x => new { x.ProductionOrderCode, x.ProductName })
                .OrderBy(x => x.Key.ProductionOrderCode, StringComparer.Ordinal)
                .ThenBy(x => x.Key.ProductName, StringComparer.Ordinal);
            foreach (var block in blocks)
            {
                AddRow(data, row++, Text($"MÃ SX: {block.Key.ProductionOrderCode} — {block.Key.ProductName}", TitleStyle));
                AddRow(data, row++, Text($"Kỳ: {report.FromDate:dd/MM/yyyy} – {report.UntilDate:dd/MM/yyyy}", SectionStyle));
                AddRow(data, row++);
                AddHeader(data, merges, row, days, totalStart);
                row += 2;

                var groups = block
                    .GroupBy(x => new { x.EmployeeCode, x.EmployeeName, x.OperationNumber, x.Unit })
                    .OrderBy(x => x.Key.EmployeeCode, StringComparer.Ordinal)
                    .ThenBy(x => x.Key.OperationNumber)
                    .ThenBy(x => x.Key.Unit, StringComparer.Ordinal);
                string? previousEmployee = null;
                foreach (var group in groups)
                {
                    AddManagementRow(data, row++, group, days, totalStart, previousEmployee == group.Key.EmployeeCode);
                    previousEmployee = group.Key.EmployeeCode;
                }
                row += 3;
            }
        }

        return new Worksheet(
            new SheetProperties(new PageSetupProperties { FitToPage = true }),
            FrozenManagementViews(),
            ManagementColumns(days.Length, totalStart),
            data,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static void AddHeader(SheetData data, MergeCells merges, uint row, IReadOnlyList<DateOnly> days, int totalStart)
    {
        AddCells(data, row, At($"A{row}", Text("Nhân viên", HeaderStyle)), At($"B{row}", Text("CĐ", HeaderStyle)), At($"C{row}", Text("ĐVT", HeaderStyle)));
        merges.Append(new MergeCell { Reference = $"A{row}:A{row + 1}" }, new MergeCell { Reference = $"B{row}:B{row + 1}" }, new MergeCell { Reference = $"C{row}:C{row + 1}" });
        for (var i = 0; i < days.Count; i++)
        {
            var hc = 4 + i * 2;
            AddCells(data, row, At($"{Col(hc)}{row}", Text(ManagementDateLabel(days[i]), HeaderStyle)));
            merges.Append(new MergeCell { Reference = $"{Col(hc)}{row}:{Col(hc + 1)}{row}" });
            AddCells(data, row + 1, At($"{Col(hc)}{row + 1}", Text("HC", CenterStyle)), At($"{Col(hc + 1)}{row + 1}", Text("TC", CenterStyle)));
        }
        AddCells(data, row,
            At($"{Col(totalStart)}{row}", Text("Tổng HC", HeaderStyle)),
            At($"{Col(totalStart + 1)}{row}", Text("Tổng TC", HeaderStyle)),
            At($"{Col(totalStart + 2)}{row}", Text("Tổng", HeaderStyle)));
        merges.Append(
            new MergeCell { Reference = $"{Col(totalStart)}{row}:{Col(totalStart)}{row + 1}" },
            new MergeCell { Reference = $"{Col(totalStart + 1)}{row}:{Col(totalStart + 1)}{row + 1}" },
            new MergeCell { Reference = $"{Col(totalStart + 2)}{row}:{Col(totalStart + 2)}{row + 1}" });
    }

    private static void AddManagementRow(SheetData data, uint row, IEnumerable<ProductionReportRow> source, IReadOnlyList<DateOnly> days, int totalStart, bool blankEmployee)
    {
        var entries = source.ToArray();
        var first = entries[0];
        var byDay = entries.GroupBy(x => x.WorkDate).ToDictionary(x => x.Key, x => (Hc: x.Sum(y => y.HcQuantity), Tc: x.Sum(y => y.TcQuantity)));
        var hc = entries.Sum(x => x.HcQuantity);
        var tc = entries.Sum(x => x.TcQuantity);
        var cells = new List<Cell>();
        if (!blankEmployee) cells.Add(At($"A{row}", Text(first.EmployeeName, SectionStyle)));
        cells.Add(At($"B{row}", Text($"CĐ{first.OperationNumber}")));
        cells.Add(At($"C{row}", Text(first.Unit, CenterStyle)));
        for (var i = 0; i < days.Count; i++)
        {
            if (!byDay.TryGetValue(days[i], out var quantity)) continue;
            var column = 4 + i * 2;
            cells.Add(At($"{Col(column)}{row}", Num(quantity.Hc)));
            cells.Add(At($"{Col(column + 1)}{row}", Num(quantity.Tc)));
        }
        cells.Add(At($"{Col(totalStart)}{row}", Num(hc)));
        cells.Add(At($"{Col(totalStart + 1)}{row}", Num(tc)));
        cells.Add(At($"{Col(totalStart + 2)}{row}", Num(hc + tc)));
        AddCells(data, row, cells.ToArray());
    }

    private static Worksheet CreateOverviewWorksheet(ProductionReportData report)
    {
        var data = new SheetData();
        AddRow(data, 1, Text("BÁO CÁO SẢN LƯỢNG", TitleStyle)); AddRow(data, 2);
        AddRow(data, 3, Text("Kỳ báo cáo", SectionStyle), Date(report.FromDate), Text("đến", SectionStyle), Date(report.UntilDate));
        AddRow(data, 4, Text("Nhân viên", SectionStyle), Text(report.EmployeeLabel), Text("Mã sản xuất", SectionStyle), Text(report.OrderLabel));
        AddRow(data, 5, Text("Công đoạn", SectionStyle), Text(report.OperationLabel), Text("Tìm kiếm", SectionStyle), Text(report.SearchLabel)); AddRow(data, 6);
        AddRow(data, 7, Text("Nhân viên", HeaderStyle), Text("Bản ghi", HeaderStyle), Text("HC", HeaderStyle), Text("TC", HeaderStyle), Text(report.FinalMetricLabel, HeaderStyle));
        AddRow(data, 8, Num(report.Summary.EmployeeCount), Num(report.Summary.EntryCount), Num(report.Summary.HcQuantity), Num(report.Summary.TcQuantity), Num(report.Summary.TotalQuantity));
        AddRow(data, 9); AddRow(data, 10, Text("TỔNG HỢP THEO NGÀY", SectionStyle)); AddRow(data, 11, Text("Ngày", HeaderStyle), Text("HC", HeaderStyle), Text("TC", HeaderStyle), Text("Tổng", HeaderStyle));
        var row = 12U;
        foreach (var day in report.ByDay) AddRow(data, row++, Date(day.WorkDate), Num(day.HcQuantity), Num(day.TcQuantity), Num(day.TotalQuantity));
        AddRow(data, row++, Text("TỔNG", SectionStyle), Num(report.Summary.HcQuantity), Num(report.Summary.TcQuantity), Num(report.Summary.TotalQuantity)); AddRow(data, row++);
        AddRow(data, row++, Text("TỔNG HỢP THEO NHÂN VIÊN", SectionStyle)); AddRow(data, row++, Text("Mã NV", HeaderStyle), Text("Họ tên", HeaderStyle), Text("HC", HeaderStyle), Text("TC", HeaderStyle), Text("Tổng", HeaderStyle));
        foreach (var employee in report.ByEmployee) AddRow(data, row++, Text(employee.EmployeeCode), Text(employee.EmployeeName), Num(employee.HcQuantity), Num(employee.TcQuantity), Num(employee.TotalQuantity));
        AddRow(data, row, Text("TỔNG", SectionStyle), Text(string.Empty), Num(report.Summary.HcQuantity), Num(report.Summary.TcQuantity), Num(report.Summary.TotalQuantity));
        return new Worksheet(OverviewColumns(), data);
    }

    private static Worksheet CreateDetailWorksheet(ProductionReportData report)
    {
        var data = new SheetData(); AddRow(data, 1, DetailHeaders.Select(x => Text(x, HeaderStyle)).ToArray());
        var row = 2U; foreach (var item in report.Rows) data.Append(DetailRow(item, row++));
        return new Worksheet(FrozenDetailViews(), DetailColumns(), data, new AutoFilter { Reference = $"A1:M{Math.Max(1U, row - 1)}" });
    }

    private static Row DetailRow(ProductionReportRow item, uint row) { var result = new Row { RowIndex = row }; result.Append(Date(item.WorkDate), Text(item.EmployeeCode), Text(item.EmployeeName), Text(item.ProductionOrderCode), Text(item.ProductName), Text($"CĐ{item.OperationNumber} — {item.OperationName}"), Text(item.Unit), Num(item.HcQuantity), Num(item.TcQuantity), Num(item.TotalQuantity), item.OvertimeHours.HasValue ? Num(item.OvertimeHours.Value) : Text(string.Empty), Text(Mode(item.EntryMode)), Text(item.Note ?? string.Empty)); return result; }
    private static string Mode(ProductionEntryMode mode) => mode switch { ProductionEntryMode.ByShift => "Theo ca", ProductionEntryMode.Direct => "HC / TC trực tiếp", ProductionEntryMode.TotalWithOvertime => "Tổng + giờ tăng ca", _ => mode.ToString() };

    private static void AddRow(SheetData data, uint index, params Cell[] cells) { var row = new Row { RowIndex = index }; row.Append(cells); data.Append(row); }
    private static void AddCells(SheetData data, uint index, params Cell[] cells) { var row = data.Elements<Row>().SingleOrDefault(x => x.RowIndex?.Value == index) ?? new Row { RowIndex = index }; if (row.Parent is null) data.Append(row); row.Append(cells.OrderBy(x => ColumnNumber(x.CellReference?.Value))); }
    private static Cell At(string reference, Cell cell) { cell.CellReference = reference; return cell; }
    private static Cell Text(string value, uint style = 0U) => new() { DataType = CellValues.InlineString, StyleIndex = style, InlineString = new InlineString(new Text(value)) };
    private static Cell Num(decimal value) => new() { StyleIndex = NumericStyle, CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture)) };
    private static Cell Num(int value) => Num((decimal)value);
    private static Cell Date(DateOnly value) => new() { StyleIndex = DateStyle, CellValue = new CellValue(value.ToDateTime(TimeOnly.MinValue).ToOADate().ToString(CultureInfo.InvariantCulture)) };

    private static SheetViews FrozenManagementViews() => new(new SheetView(new Pane { VerticalSplit = 3D, HorizontalSplit = 5D, TopLeftCell = "D6", ActivePane = PaneValues.BottomRight, State = PaneStateValues.Frozen }) { WorkbookViewId = 0U });
    private static SheetViews FrozenDetailViews() => new(new SheetView(new Pane { VerticalSplit = 1D, TopLeftCell = "A2", ActivePane = PaneValues.BottomLeft, State = PaneStateValues.Frozen }) { WorkbookViewId = 0U });
    private static Columns ManagementColumns(int days, int totalStart) { var columns = new Columns(Column(1, 26), Column(2, 9), Column(3, 10)); for (var i = 0; i < days * 2; i++) columns.Append(Column((uint)(4 + i), 10)); columns.Append(Column((uint)totalStart, 12), Column((uint)totalStart + 1, 12), Column((uint)totalStart + 2, 12)); return columns; }
    private static Columns OverviewColumns() => new(Column(1, 18), Column(2, 22), Column(3, 14), Column(4, 22), Column(5, 22));
    private static Columns DetailColumns() => new(Column(1, 12), Column(2, 12), Column(3, 24), Column(4, 14), Column(5, 24), Column(6, 28), Column(7, 12), Column(8, 12), Column(9, 12), Column(10, 12), Column(11, 12), Column(12, 18), Column(13, 30));
    private static Column Column(uint index, double width) => new() { Min = index, Max = index, Width = width, CustomWidth = true };
    private static IEnumerable<DateOnly> Dates(DateOnly from, DateOnly until) { for (var date = from; date <= until; date = date.AddDays(1)) yield return date; }

    private static string ManagementDateLabel(DateOnly date)
    {
        var weekday = date.DayOfWeek switch
        {
            DayOfWeek.Monday => "T2",
            DayOfWeek.Tuesday => "T3",
            DayOfWeek.Wednesday => "T4",
            DayOfWeek.Thursday => "T5",
            DayOfWeek.Friday => "T6",
            DayOfWeek.Saturday => "T7",
            DayOfWeek.Sunday => "CN",
            _ => throw new ArgumentOutOfRangeException(nameof(date))
        };

        return $"{weekday} {date:dd/MM/yyyy}";
    }

    private static string Col(int value) { var result = string.Empty; while (value > 0) { value--; result = (char)('A' + value % 26) + result; value /= 26; } return result; }
    private static int ColumnNumber(string? reference) { if (string.IsNullOrEmpty(reference)) return int.MaxValue; var result = 0; foreach (var c in reference) { if (!char.IsLetter(c)) break; result = result * 26 + char.ToUpperInvariant(c) - 'A' + 1; } return result; }

    private static Stylesheet CreateStylesheet()
    {
        var formats = new NumberingFormats(new NumberingFormat { NumberFormatId = 164U, FormatCode = "dd/MM/yyyy" }) { Count = 1U };
        var fonts = new Fonts(new Font(), new Font(new Bold()), new Font(new Bold(), new FontSize { Val = 14D })) { Count = 3U };
        var fills = new Fills(new Fill(new PatternFill { PatternType = PatternValues.None }), new Fill(new PatternFill { PatternType = PatternValues.Gray125 }), new Fill(new PatternFill(new ForegroundColor { Rgb = "FFD9EAF7" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid })) { Count = 3U };
        var formatsForCells = new CellFormats(
            new CellFormat(),
            new CellFormat { NumberFormatId = 164U, ApplyNumberFormat = true },
            new CellFormat { FontId = 2U, ApplyFont = true },
            new CellFormat { FontId = 1U, FillId = 2U, ApplyFont = true, ApplyFill = true, ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Center } },
            new CellFormat { FontId = 1U, ApplyFont = true },
            new CellFormat { ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Right } },
            new CellFormat { ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Center } })
        { Count = 7U };
        return new Stylesheet(formats, fonts, fills, new Borders(new Border()) { Count = 1U }, new CellStyleFormats(new CellFormat()) { Count = 1U }, formatsForCells);
    }
}