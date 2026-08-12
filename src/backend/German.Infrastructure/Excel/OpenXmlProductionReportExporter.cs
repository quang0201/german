using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;

namespace German.Infrastructure.Excel;

public sealed class OpenXmlProductionReportExporter : IProductionReportExporter
{
    private const uint DateStyleIndex = 1U;
    private const uint HeaderStyleIndex = 2U;

    private static readonly string[] Headers =
    [
        "Ngày", "Mã NV", "Họ tên", "Mã SX", "Sản phẩm", "CĐ", "Tên công đoạn",
        "Đơn vị", "HC", "TC", "Tổng", "Giờ TC", "Kiểu nhập", "Ghi chú"
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

            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            var sheetData = new SheetData();
            var worksheet = new Worksheet();
            worksheet.Append(CreateSheetViews());
            worksheet.Append(CreateColumns());
            worksheet.Append(sheetData);

            var headerRow = new Row { RowIndex = 1U };
            foreach (var header in Headers)
            {
                headerRow.Append(TextCell(header, HeaderStyleIndex));
            }
            sheetData.Append(headerRow);

            uint rowIndex = 2U;
            foreach (var row in report.Rows)
            {
                sheetData.Append(CreateDataRow(row, rowIndex));
                rowIndex++;
            }

            var lastRow = Math.Max(1U, rowIndex - 1U);
            worksheet.Append(new AutoFilter { Reference = $"A1:N{lastRow}" });
            worksheetPart.Worksheet = worksheet;
            worksheetPart.Worksheet.Save();

            var sheets = workbookPart.Workbook.AppendChild(new Sheets());
            sheets.Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = 1U,
                Name = "Sản lượng"
            });
            workbookPart.Workbook.Save();
        }

        return stream.ToArray();
    }

    private static Row CreateDataRow(ProductionReportRow data, uint rowIndex)
    {
        var row = new Row { RowIndex = rowIndex };
        row.Append(
            DateCell(data.WorkDate),
            TextCell(data.EmployeeCode),
            TextCell(data.EmployeeName),
            TextCell(data.ProductionOrderCode),
            TextCell(data.ProductName),
            NumberCell(data.OperationNumber),
            TextCell(data.OperationName),
            TextCell(data.Unit),
            NumberCell(data.HcQuantity),
            NumberCell(data.TcQuantity),
            NumberCell(data.TotalQuantity),
            data.OvertimeHours.HasValue ? NumberCell(data.OvertimeHours.Value) : TextCell(string.Empty),
            TextCell(data.EntryMode.ToString()),
            TextCell(data.Note ?? string.Empty));
        return row;
    }

    private static Cell TextCell(string value, uint styleIndex = 0U) => new()
    {
        DataType = CellValues.InlineString,
        StyleIndex = styleIndex,
        InlineString = new InlineString(new Text(value))
    };

    private static Cell NumberCell(decimal value) => new()
    {
        CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture))
    };

    private static Cell NumberCell(int value) => new()
    {
        CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture))
    };

    private static Cell DateCell(DateOnly value) => new()
    {
        StyleIndex = DateStyleIndex,
        CellValue = new CellValue(
            value.ToDateTime(TimeOnly.MinValue).ToOADate().ToString(CultureInfo.InvariantCulture))
    };

    private static SheetViews CreateSheetViews() => new(
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

    private static Columns CreateColumns() => new(
        Column(1, 12),
        Column(2, 12),
        Column(3, 24),
        Column(4, 14),
        Column(5, 24),
        Column(6, 8),
        Column(7, 28),
        Column(8, 12),
        Column(9, 12),
        Column(10, 12),
        Column(11, 12),
        Column(12, 12),
        Column(13, 18),
        Column(14, 30));

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
            new Font(new Bold()))
        {
            Count = 2U
        };

        var fills = new Fills(
            new Fill(new PatternFill { PatternType = PatternValues.None }),
            new Fill(new PatternFill { PatternType = PatternValues.Gray125 }))
        {
            Count = 2U
        };

        var borders = new Borders(new Border()) { Count = 1U };
        var cellStyleFormats = new CellStyleFormats(new CellFormat()) { Count = 1U };
        var cellFormats = new CellFormats(
            new CellFormat(),
            new CellFormat { NumberFormatId = 164U, ApplyNumberFormat = true },
            new CellFormat { FontId = 1U, ApplyFont = true })
        {
            Count = 3U
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
