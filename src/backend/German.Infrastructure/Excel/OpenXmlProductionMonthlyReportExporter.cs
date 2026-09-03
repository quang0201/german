using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;

namespace German.Infrastructure.Excel;

public sealed class OpenXmlProductionMonthlyReportExporter : IProductionMonthlyReportExporter
{
    private const uint TitleStyle = 1U;
    private const uint HeaderStyle = 2U;
    private const uint TextStyle = 3U;
    private const uint HcHeaderStyle = 5U;
    private const uint TcHeaderStyle = 6U;
    private const uint HcNumberStyle = 7U;
    private const uint TcNumberStyle = 8U;
    private const uint TotalHeaderStyle = 9U;
    private const uint TotalNumberStyle = 10U;

    public byte[] Export(ProductionMonthlyOperationSummaryReport report)
    {
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook))
        {
            var workbookPart = document.AddWorkbookPart();
            workbookPart.Workbook = new Workbook(new BookViews(new WorkbookView { ActiveTab = 0U }));

            var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet = CreateStylesheet();
            stylesPart.Stylesheet.Save();

            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            worksheetPart.Worksheet = CreateWorksheet(report);
            worksheetPart.Worksheet.Save();

            workbookPart.Workbook.AppendChild(new Sheets()).Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = 1U,
                Name = "Báo cáo tháng"
            });
            workbookPart.Workbook.Save();
        }

        return stream.ToArray();
    }

    private static Worksheet CreateWorksheet(ProductionMonthlyOperationSummaryReport report)
    {
        var data = new SheetData();
        var merges = new MergeCells();
        var monthColumnStart = 4;
        var totalColumnStart = monthColumnStart + report.Months.Count * 2;

        AddRow(data, 1U, Text("BÁO CÁO SẢN LƯỢNG THEO THÁNG", TitleStyle));
        AddRow(data, 2U, Text($"Mã SX: {report.OrderCode} — {report.ProductName}", TextStyle));
        AddRow(data, 3U);

        AddCells(data, 4U,
            At("A4", Text("Công đoạn", HeaderStyle)),
            At("B4", Text("Tên công đoạn", HeaderStyle)),
            At("C4", Text("ĐVT", HeaderStyle)));
        AddCells(data, 5U, At("A5", Text(string.Empty, HeaderStyle)), At("B5", Text(string.Empty, HeaderStyle)), At("C5", Text(string.Empty, HeaderStyle)));
        merges.Append(
            new MergeCell { Reference = "A4:A5" },
            new MergeCell { Reference = "B4:B5" },
            new MergeCell { Reference = "C4:C5" });

        for (var index = 0; index < report.Months.Count; index++)
        {
            var column = monthColumnStart + index * 2;
            var month = report.Months[index];
            AddCells(data, 4U, At(Col(column) + "4", Text(month.Month.ToString("00", CultureInfo.InvariantCulture) + "/" + month.Year.ToString(CultureInfo.InvariantCulture), HeaderStyle)));
            merges.Append(new MergeCell { Reference = Col(column) + "4:" + Col(column + 1) + "4" });
            AddCells(data, 5U,
                At(Col(column) + "5", Text("HC", HcHeaderStyle)),
                At(Col(column + 1) + "5", Text("TC", TcHeaderStyle)));
        }

        AddCells(data, 4U,
            At(Col(totalColumnStart) + "4", Text("Tổng HC", HcHeaderStyle)),
            At(Col(totalColumnStart + 1) + "4", Text("Tổng TC", TcHeaderStyle)),
            At(Col(totalColumnStart + 2) + "4", Text("Tổng cộng", TotalHeaderStyle)));
        merges.Append(
            new MergeCell { Reference = Col(totalColumnStart) + "4:" + Col(totalColumnStart) + "5" },
            new MergeCell { Reference = Col(totalColumnStart + 1) + "4:" + Col(totalColumnStart + 1) + "5" },
            new MergeCell { Reference = Col(totalColumnStart + 2) + "4:" + Col(totalColumnStart + 2) + "5" });

        var row = 6U;
        foreach (var operation in report.Operations)
        {
            var cells = new List<Cell>
            {
                At("A" + row, Text("CĐ" + operation.OperationNumber.ToString(CultureInfo.InvariantCulture), TextStyle)),
                At("B" + row, Text(operation.Name, TextStyle)),
                At("C" + row, Text(operation.Unit, TextStyle))
            };

            var monthValues = operation.Months.ToDictionary(item => item.MonthKey);
            for (var index = 0; index < report.Months.Count; index++)
            {
                var month = report.Months[index];
                monthValues.TryGetValue(month.Year.ToString("0000", CultureInfo.InvariantCulture) + "-" + month.Month.ToString("00", CultureInfo.InvariantCulture), out var value);
                var column = monthColumnStart + index * 2;
                cells.Add(At(Col(column) + row, Num(value?.HcQuantity ?? 0m, HcNumberStyle)));
                cells.Add(At(Col(column + 1) + row, Num(value?.TcQuantity ?? 0m, TcNumberStyle)));
            }

            cells.Add(At(Col(totalColumnStart) + row, Num(operation.HcQuantity, HcNumberStyle)));
            cells.Add(At(Col(totalColumnStart + 1) + row, Num(operation.TcQuantity, TcNumberStyle)));
            cells.Add(At(Col(totalColumnStart + 2) + row, Num(operation.TotalQuantity, TotalNumberStyle)));
            AddCells(data, row, cells.ToArray());
            row++;
        }

        var totalCells = new List<Cell>
        {
            At("A" + row, Text("TỔNG CỘNG", HeaderStyle)),
            At("B" + row, Text(string.Empty, HeaderStyle)),
            At("C" + row, Text(string.Empty, HeaderStyle))
        };
        for (var index = 0; index < report.Months.Count; index++)
        {
            var month = report.Months[index];
            var monthKey = month.Year.ToString("0000", CultureInfo.InvariantCulture) + "-" + month.Month.ToString("00", CultureInfo.InvariantCulture);
            var monthValues = report.Operations
                .SelectMany(operation => operation.Months)
                .Where(value => value.MonthKey == monthKey)
                .ToArray();
            var column = monthColumnStart + index * 2;
            totalCells.Add(At(Col(column) + row, Num(monthValues.Sum(value => value.HcQuantity), HcNumberStyle)));
            totalCells.Add(At(Col(column + 1) + row, Num(monthValues.Sum(value => value.TcQuantity), TcNumberStyle)));
        }
        totalCells.Add(At(Col(totalColumnStart) + row, Num(report.Operations.Sum(operation => operation.HcQuantity), HcNumberStyle)));
        totalCells.Add(At(Col(totalColumnStart + 1) + row, Num(report.Operations.Sum(operation => operation.TcQuantity), TcNumberStyle)));
        totalCells.Add(At(Col(totalColumnStart + 2) + row, Num(report.Operations.Sum(operation => operation.TotalQuantity), TotalNumberStyle)));
        AddCells(data, row, totalCells.ToArray());

        return new Worksheet(
            new SheetProperties(new PageSetupProperties { FitToPage = true }),
            new SheetViews(new SheetView(new Pane
            {
                HorizontalSplit = 3D,
                VerticalSplit = 5D,
                TopLeftCell = "D6",
                ActivePane = PaneValues.BottomRight,
                State = PaneStateValues.Frozen
            }) { WorkbookViewId = 0U }),
            Columns(report, totalColumnStart),
            data,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static Columns Columns(ProductionMonthlyOperationSummaryReport report, int totalColumnStart)
    {
        var columns = new Columns(Column(1U, 14D), Column(2U, 28D), Column(3U, 12D));
        for (var index = 0; index < report.Months.Count * 2; index++)
        {
            columns.Append(Column((uint)(4 + index), 12D));
        }

        columns.Append(Column((uint)totalColumnStart, 14D), Column((uint)totalColumnStart + 1U, 14D), Column((uint)totalColumnStart + 2U, 14D));
        return columns;
    }

    private static void AddRow(SheetData data, uint index, params Cell[] cells)
    {
        var row = new Row { RowIndex = index };
        row.Append(cells);
        data.Append(row);
    }

    private static void AddCells(SheetData data, uint index, params Cell[] cells)
    {
        var row = data.Elements<Row>().SingleOrDefault(item => item.RowIndex?.Value == index)
            ?? new Row { RowIndex = index };
        if (row.Parent is null)
        {
            data.Append(row);
        }

        row.Append(cells.OrderBy(item => ColumnNumber(item.CellReference?.Value)));
    }

    private static Cell At(string reference, Cell cell)
    {
        cell.CellReference = reference;
        return cell;
    }

    private static Cell Text(string value, uint style = 0U) => new()
    {
        DataType = CellValues.InlineString,
        StyleIndex = style,
        InlineString = new InlineString(new Text(value))
    };

    private static Cell Num(decimal value, uint style) => new()
    {
        StyleIndex = style,
        CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture))
    };

    private static string Col(int value)
    {
        var result = string.Empty;
        while (value > 0)
        {
            value--;
            result = (char)('A' + value % 26) + result;
            value /= 26;
        }

        return result;
    }

    private static int ColumnNumber(string? reference)
    {
        if (string.IsNullOrEmpty(reference)) return int.MaxValue;
        var result = 0;
        foreach (var character in reference)
        {
            if (!char.IsLetter(character)) break;
            result = result * 26 + char.ToUpperInvariant(character) - 'A' + 1;
        }

        return result;
    }

    private static Column Column(uint index, double width) => new()
    {
        Min = index,
        Max = index,
        Width = width,
        CustomWidth = true
    };

    private static Stylesheet CreateStylesheet()
    {
        var fonts = new Fonts(
            new Font(),
            new Font(new Bold()),
            new Font(new Bold(), new FontSize { Val = 14D })) { Count = 3U };
        var fills = new Fills(
            new Fill(new PatternFill { PatternType = PatternValues.None }),
            new Fill(new PatternFill { PatternType = PatternValues.Gray125 }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFD9EAF7" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFEAF4FB" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFFFE6CC" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid })) { Count = 5U };
        var borders = new Borders(
            new Border(),
            new Border(new LeftBorder { Style = BorderStyleValues.Thin }, new RightBorder { Style = BorderStyleValues.Thin }, new TopBorder { Style = BorderStyleValues.Thin }, new BottomBorder { Style = BorderStyleValues.Thin }),
            new Border(new LeftBorder { Style = BorderStyleValues.Medium }, new RightBorder { Style = BorderStyleValues.Medium }, new TopBorder { Style = BorderStyleValues.Medium }, new BottomBorder { Style = BorderStyleValues.Medium })) { Count = 3U };
        var formats = new CellFormats(
            new CellFormat(),
            new CellFormat { FontId = 2U, ApplyFont = true },
            new CellFormat { FontId = 1U, BorderId = 2U, FillId = 2U, ApplyFont = true, ApplyBorder = true, ApplyFill = true, ApplyAlignment = true, Alignment = Centered() },
            new CellFormat { BorderId = 1U, ApplyBorder = true, ApplyAlignment = true, Alignment = new Alignment { Vertical = VerticalAlignmentValues.Center } },
            new CellFormat { BorderId = 1U, ApplyBorder = true, ApplyAlignment = true, Alignment = Right() },
            new CellFormat { FontId = 1U, BorderId = 2U, FillId = 3U, ApplyFont = true, ApplyBorder = true, ApplyFill = true, ApplyAlignment = true, Alignment = Centered() },
            new CellFormat { FontId = 1U, BorderId = 2U, FillId = 4U, ApplyFont = true, ApplyBorder = true, ApplyFill = true, ApplyAlignment = true, Alignment = Centered() },
            new CellFormat { BorderId = 1U, FillId = 3U, ApplyBorder = true, ApplyFill = true, ApplyAlignment = true, Alignment = Right() },
            new CellFormat { BorderId = 1U, FillId = 4U, ApplyBorder = true, ApplyFill = true, ApplyAlignment = true, Alignment = Right() },
            new CellFormat { FontId = 1U, BorderId = 2U, FillId = 2U, ApplyFont = true, ApplyBorder = true, ApplyFill = true, ApplyAlignment = true, Alignment = Centered() },
            new CellFormat { BorderId = 2U, ApplyBorder = true, ApplyAlignment = true, Alignment = Right() }) { Count = 11U };

        return new Stylesheet(fonts, fills, borders, new CellStyleFormats(new CellFormat()) { Count = 1U }, formats);
    }

    private static Alignment Centered() => new()
    {
        Horizontal = HorizontalAlignmentValues.Center,
        Vertical = VerticalAlignmentValues.Center,
        WrapText = true
    };

    private static Alignment Right() => new()
    {
        Horizontal = HorizontalAlignmentValues.Right,
        Vertical = VerticalAlignmentValues.Center
    };
}
