using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;

namespace German.Infrastructure.Excel;

public sealed class OpenXmlProductionReportExporter : IProductionReportExporter
{
    private const uint DateStyleIndex = 1U;
    private const uint TitleStyleIndex = 2U;
    private const uint HeaderStyleIndex = 3U;
    private const uint SectionStyleIndex = 4U;
    private const uint NumericStyleIndex = 5U;

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
            workbookPart.Workbook = new Workbook();

            var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet = CreateStylesheet();
            stylesPart.Stylesheet.Save();

            var overviewPart = workbookPart.AddNewPart<WorksheetPart>();
            overviewPart.Worksheet = CreateOverviewWorksheet(report);
            overviewPart.Worksheet.Save();

            var detailPart = workbookPart.AddNewPart<WorksheetPart>();
            detailPart.Worksheet = CreateDetailWorksheet(report);
            detailPart.Worksheet.Save();

            var sheets = workbookPart.Workbook.AppendChild(new Sheets());
            sheets.Append(
                CreateSheet(workbookPart, overviewPart, 1U, "Tổng quan"),
                CreateSheet(workbookPart, detailPart, 2U, "Chi tiết"));
            workbookPart.Workbook.Save();
        }

        return stream.ToArray();
    }

    private static Worksheet CreateOverviewWorksheet(ProductionReportData report)
    {
        var sheetData = new SheetData();

        AppendRow(sheetData, 1U, TextCell("BÁO CÁO SẢN LƯỢNG", TitleStyleIndex));
        AppendRow(sheetData, 2U);
        AppendRow(sheetData, 3U,
            TextCell("Kỳ báo cáo", SectionStyleIndex),
            DateCell(report.FromDate),
            TextCell("đến", SectionStyleIndex),
            DateCell(report.UntilDate));
        AppendRow(sheetData, 4U,
            TextCell("Nhân viên", SectionStyleIndex),
            TextCell(report.EmployeeLabel),
            TextCell("Mã sản xuất", SectionStyleIndex),
            TextCell(report.OrderLabel));
        AppendRow(sheetData, 5U,
            TextCell("Công đoạn", SectionStyleIndex),
            TextCell(report.OperationLabel),
            TextCell("Tìm kiếm", SectionStyleIndex),
            TextCell(report.SearchLabel));
        AppendRow(sheetData, 6U);
        AppendRow(sheetData, 7U,
            TextCell("Nhân viên", HeaderStyleIndex),
            TextCell("Bản ghi", HeaderStyleIndex),
            TextCell("HC", HeaderStyleIndex),
            TextCell("TC", HeaderStyleIndex),
            TextCell(report.FinalMetricLabel, HeaderStyleIndex));
        AppendRow(sheetData, 8U,
            NumberCell(report.Summary.EmployeeCount),
            NumberCell(report.Summary.EntryCount),
            NumberCell(report.Summary.HcQuantity),
            NumberCell(report.Summary.TcQuantity),
            NumberCell(report.Summary.TotalQuantity));
        AppendRow(sheetData, 9U);
        AppendRow(sheetData, 10U, TextCell("TỔNG HỢP THEO NGÀY", SectionStyleIndex));
        AppendRow(sheetData, 11U,
            TextCell("Ngày", HeaderStyleIndex),
            TextCell("HC", HeaderStyleIndex),
            TextCell("TC", HeaderStyleIndex),
            TextCell("Tổng", HeaderStyleIndex));

        uint rowIndex = 12U;
        foreach (var day in report.ByDay)
        {
            AppendRow(sheetData, rowIndex++,
                DateCell(day.WorkDate),
                NumberCell(day.HcQuantity),
                NumberCell(day.TcQuantity),
                NumberCell(day.TotalQuantity));
        }
        AppendRow(sheetData, rowIndex++,
            TextCell("TỔNG", SectionStyleIndex),
            NumberCell(report.Summary.HcQuantity),
            NumberCell(report.Summary.TcQuantity),
            NumberCell(report.Summary.TotalQuantity));

        AppendRow(sheetData, rowIndex++);
        AppendRow(sheetData, rowIndex++, TextCell("TỔNG HỢP THEO NHÂN VIÊN", SectionStyleIndex));
        AppendRow(sheetData, rowIndex++,
            TextCell("Mã NV", HeaderStyleIndex),
            TextCell("Họ tên", HeaderStyleIndex),
            TextCell("HC", HeaderStyleIndex),
            TextCell("TC", HeaderStyleIndex),
            TextCell("Tổng", HeaderStyleIndex));
        foreach (var employee in report.ByEmployee)
        {
            AppendRow(sheetData, rowIndex++,
                TextCell(employee.EmployeeCode),
                TextCell(employee.EmployeeName),
                NumberCell(employee.HcQuantity),
                NumberCell(employee.TcQuantity),
                NumberCell(employee.TotalQuantity));
        }
        AppendRow(sheetData, rowIndex,
            TextCell("TỔNG", SectionStyleIndex),
            TextCell(string.Empty),
            NumberCell(report.Summary.HcQuantity),
            NumberCell(report.Summary.TcQuantity),
            NumberCell(report.Summary.TotalQuantity));

        return new Worksheet(CreateOverviewColumns(), sheetData);
    }

    private static Worksheet CreateDetailWorksheet(ProductionReportData report)
    {
        var sheetData = new SheetData();
        AppendRow(sheetData, 1U, DetailHeaders.Select(header => TextCell(header, HeaderStyleIndex)).ToArray());

        uint rowIndex = 2U;
        foreach (var row in report.Rows)
        {
            sheetData.Append(CreateDetailDataRow(row, rowIndex++));
        }

        var lastRow = Math.Max(1U, rowIndex - 1U);
        return new Worksheet(
            CreateFrozenSheetViews(),
            CreateDetailColumns(),
            sheetData,
            new AutoFilter { Reference = $"A1:M{lastRow}" });
    }

    private static Sheet CreateSheet(WorkbookPart workbookPart, WorksheetPart worksheetPart, uint sheetId, string name) => new()
    {
        Id = workbookPart.GetIdOfPart(worksheetPart),
        SheetId = sheetId,
        Name = name
    };

    private static Row CreateDetailDataRow(ProductionReportRow data, uint rowIndex)
    {
        var row = new Row { RowIndex = rowIndex };
        row.Append(
            DateCell(data.WorkDate),
            TextCell(data.EmployeeCode),
            TextCell(data.EmployeeName),
            TextCell(data.ProductionOrderCode),
            TextCell(data.ProductName),
            TextCell($"CĐ{data.OperationNumber} — {data.OperationName}"),
            TextCell(data.Unit),
            NumberCell(data.HcQuantity),
            NumberCell(data.TcQuantity),
            NumberCell(data.TotalQuantity),
            data.OvertimeHours.HasValue ? NumberCell(data.OvertimeHours.Value) : TextCell(string.Empty),
            TextCell(data.EntryMode.ToString()),
            TextCell(data.Note ?? string.Empty));
        return row;
    }

    private static void AppendRow(SheetData sheetData, uint rowIndex, params Cell[] cells)
    {
        var row = new Row { RowIndex = rowIndex };
        row.Append(cells);
        sheetData.Append(row);
    }

    private static Cell TextCell(string value, uint styleIndex = 0U) => new()
    {
        DataType = CellValues.InlineString,
        StyleIndex = styleIndex,
        InlineString = new InlineString(new Text(value))
    };

    private static Cell NumberCell(decimal value) => new()
    {
        StyleIndex = NumericStyleIndex,
        CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture))
    };

    private static Cell NumberCell(int value) => new()
    {
        StyleIndex = NumericStyleIndex,
        CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture))
    };

    private static Cell DateCell(DateOnly value) => new()
    {
        StyleIndex = DateStyleIndex,
        CellValue = new CellValue(
            value.ToDateTime(TimeOnly.MinValue).ToOADate().ToString(CultureInfo.InvariantCulture))
    };

    private static SheetViews CreateFrozenSheetViews() => new(
        new SheetView(
            new Pane
            {
                VerticalSplit = 1D,
                TopLeftCell = "A2",
                ActivePane = PaneValues.BottomLeft,
                State = PaneStateValues.Frozen
            })
        {
            WorkbookViewId = 0U
        });

    private static Columns CreateOverviewColumns() => new(
        Column(1, 18),
        Column(2, 22),
        Column(3, 14),
        Column(4, 22),
        Column(5, 22));

    private static Columns CreateDetailColumns() => new(
        Column(1, 12),
        Column(2, 12),
        Column(3, 24),
        Column(4, 14),
        Column(5, 24),
        Column(6, 28),
        Column(7, 12),
        Column(8, 12),
        Column(9, 12),
        Column(10, 12),
        Column(11, 12),
        Column(12, 18),
        Column(13, 30));

    private static Column Column(uint index, double width) => new()
    {
        Min = index,
        Max = index,
        Width = width,
        CustomWidth = true
    };

    private static Stylesheet CreateStylesheet()
    {
        var numberingFormats = new NumberingFormats(
            new NumberingFormat { NumberFormatId = 164U, FormatCode = "dd/MM/yyyy" })
        {
            Count = 1U
        };

        var fonts = new Fonts(
            new Font(),
            new Font(new Bold()),
            new Font(new Bold(), new FontSize { Val = 14D }))
        {
            Count = 3U
        };

        var fills = new Fills(
            new Fill(new PatternFill { PatternType = PatternValues.None }),
            new Fill(new PatternFill { PatternType = PatternValues.Gray125 }),
            new Fill(new PatternFill(
                new ForegroundColor { Rgb = "FFD9EAF7" },
                new BackgroundColor { Indexed = 64U })
            {
                PatternType = PatternValues.Solid
            }))
        {
            Count = 3U
        };

        var borders = new Borders(new Border()) { Count = 1U };
        var cellStyleFormats = new CellStyleFormats(new CellFormat()) { Count = 1U };
        var cellFormats = new CellFormats(
            new CellFormat(),
            new CellFormat { NumberFormatId = 164U, ApplyNumberFormat = true },
            new CellFormat { FontId = 2U, ApplyFont = true },
            new CellFormat { FontId = 1U, FillId = 2U, ApplyFont = true, ApplyFill = true },
            new CellFormat { FontId = 1U, ApplyFont = true },
            new CellFormat
            {
                ApplyAlignment = true,
                Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Right }
            })
        {
            Count = 6U
        };

        return new Stylesheet(
            numberingFormats,
            fonts,
            fills,
            borders,
            cellStyleFormats,
            cellFormats);
    }
}
