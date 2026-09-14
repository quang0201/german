using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;

namespace German.Infrastructure.Excel;

public sealed class OpenXmlProductionReportExporter : IProductionReportExporter
{
    private const uint DateStyle = 1U;
    private const uint TitleStyle = 2U;
    private const uint HeaderStyle = 3U;
    private const uint SectionStyle = 4U;
    private const uint NumericStyle = 5U;
    private const uint CenterStyle = 6U;
    private const uint HcBodyStyle = 7U;
    private const uint TcBodyStyle = 8U;
    private const uint HcHeaderStyle = 9U;
    private const uint TcHeaderStyle = 10U;
    private const uint ExternalTextStyle = 11U;
    private const uint ExternalNumberStyle = 12U;

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

            var productionWorksheetPart = AddWorksheet(workbookPart, CreateProductionWorksheet(report));
            var attendanceWorksheetPart = AddWorksheet(workbookPart, CreateAttendanceWorksheet(report));
            workbookPart.Workbook.AppendChild(new Sheets()).Append(
                Sheet(workbookPart, productionWorksheetPart, 1U, "Báo cáo sản lượng"),
                Sheet(workbookPart, attendanceWorksheetPart, 2U, "Bảng công"));
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
                    .ThenBy(x => x.Key.EmployeeName, StringComparer.Ordinal)
                    .ThenBy(x => x.Key.OperationNumber)
                    .ThenBy(x => x.Key.Unit, StringComparer.Ordinal);
                string? previousEmployeeCode = null;
                string? previousEmployeeName = null;
                foreach (var group in groups)
                {
                    var sameEmployee = previousEmployeeCode == group.Key.EmployeeCode
                        && previousEmployeeName == group.Key.EmployeeName;
                    AddManagementRow(data, row++, group, days, totalStart, sameEmployee);
                    previousEmployeeCode = group.Key.EmployeeCode;
                    previousEmployeeName = group.Key.EmployeeName;
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
            AddCells(data, row + 1, At($"{Col(hc)}{row + 1}", Text("HC", HcHeaderStyle)), At($"{Col(hc + 1)}{row + 1}", Text("TC", TcHeaderStyle)));
        }
        AddCells(data, row,
            At($"{Col(totalStart)}{row}", Text("Tổng HC", HcHeaderStyle)),
            At($"{Col(totalStart + 1)}{row}", Text("Tổng TC", TcHeaderStyle)),
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
        var isExternal = entries.All(item => item.IsExternal);
        var byDay = entries.GroupBy(x => x.WorkDate).ToDictionary(x => x.Key, x => (Hc: x.Sum(y => y.HcQuantity), Tc: x.Sum(y => y.TcQuantity)));
        var hc = entries.Sum(x => x.HcQuantity);
        var tc = entries.Sum(x => x.TcQuantity);
        var cells = new List<Cell>();
        if (!blankEmployee) cells.Add(At($"A{row}", Text(first.EmployeeName, isExternal ? ExternalTextStyle : SectionStyle)));
        cells.Add(At($"B{row}", Text($"CĐ{first.OperationNumber}", isExternal ? ExternalTextStyle : 0U)));
        cells.Add(At($"C{row}", Text(first.Unit, isExternal ? ExternalTextStyle : CenterStyle)));
        for (var i = 0; i < days.Count; i++)
        {
            var column = 4 + i * 2;
            if (byDay.TryGetValue(days[i], out var quantity))
            {
                cells.Add(At($"{Col(column)}{row}", isExternal ? ExternalNum(quantity.Hc) : HcNum(quantity.Hc)));
                cells.Add(At($"{Col(column + 1)}{row}", isExternal ? ExternalNum(quantity.Tc) : TcNum(quantity.Tc)));
            }
            else
            {
                cells.Add(At($"{Col(column)}{row}", Blank(isExternal ? ExternalNumberStyle : HcBodyStyle)));
                cells.Add(At($"{Col(column + 1)}{row}", Blank(isExternal ? ExternalNumberStyle : TcBodyStyle)));
            }
        }
        cells.Add(At($"{Col(totalStart)}{row}", isExternal ? ExternalNum(hc) : HcNum(hc)));
        cells.Add(At($"{Col(totalStart + 1)}{row}", isExternal ? ExternalNum(tc) : TcNum(tc)));
        cells.Add(At($"{Col(totalStart + 2)}{row}", isExternal ? ExternalNum(hc + tc) : Num(hc + tc)));
        AddCells(data, row, cells.ToArray());
    }

    private static Worksheet CreateOverviewWorksheet(ProductionReportData report)
    {
        var data = new SheetData();
        AddRow(data, 1, Text("BÁO CÁO SẢN LƯỢNG", TitleStyle)); AddRow(data, 2);
        AddRow(data, 3, Text("Kỳ báo cáo", SectionStyle), Date(report.FromDate), Text("đến", SectionStyle), Date(report.UntilDate));
        AddRow(data, 4, Text("Nhân viên", SectionStyle), Text(report.EmployeeLabel), Text("Mã sản xuất", SectionStyle), Text(report.OrderLabel));
        AddRow(data, 5, Text("Công đoạn", SectionStyle), Text(report.OperationLabel), Text("Tìm kiếm", SectionStyle), Text(report.SearchLabel)); AddRow(data, 6);
        AddRow(data, 7, Text("Nhân viên", HeaderStyle), Text("Bản ghi", HeaderStyle), Text("HC", HcHeaderStyle), Text("TC", TcHeaderStyle), Text(report.FinalMetricLabel, HeaderStyle));
        AddRow(data, 8, Num(report.Summary.EmployeeCount), Num(report.Summary.EntryCount), HcNum(report.Summary.HcQuantity), TcNum(report.Summary.TcQuantity), Num(report.Summary.TotalQuantity));
        AddRow(data, 9); AddRow(data, 10, Text("TỔNG HỢP THEO NGÀY", SectionStyle)); AddRow(data, 11, Text("Ngày", HeaderStyle), Text("HC", HcHeaderStyle), Text("TC", TcHeaderStyle), Text("Tổng", HeaderStyle));
        var row = 12U;
        foreach (var day in report.ByDay) AddRow(data, row++, Date(day.WorkDate), HcNum(day.HcQuantity), TcNum(day.TcQuantity), Num(day.TotalQuantity));
        AddRow(data, row++, Text("TỔNG", SectionStyle), HcNum(report.Summary.HcQuantity), TcNum(report.Summary.TcQuantity), Num(report.Summary.TotalQuantity)); AddRow(data, row++);
        AddRow(data, row++, Text("TỔNG HỢP THEO NHÂN VIÊN", SectionStyle)); AddRow(data, row++, Text("Mã NV", HeaderStyle), Text("Họ tên", HeaderStyle), Text("HC", HcHeaderStyle), Text("TC", TcHeaderStyle), Text("Tổng", HeaderStyle));
        foreach (var employee in report.ByEmployee)
        {
            var style = employee.IsExternal ? ExternalTextStyle : 0U;
            var numberStyle = employee.IsExternal ? ExternalNumberStyle : NumericStyle;
            AddRow(data, row++, Text(employee.EmployeeCode, style), Text(employee.EmployeeName, style), Num(employee.HcQuantity, numberStyle), Num(employee.TcQuantity, numberStyle), Num(employee.TotalQuantity, numberStyle));
        }
        AddRow(data, row, Text("TỔNG", SectionStyle), Text(string.Empty), Num(report.Summary.HcQuantity), Num(report.Summary.TcQuantity), Num(report.Summary.TotalQuantity));
        return new Worksheet(OverviewColumns(), data);
    }

    private static Worksheet CreateDailyOrderWorksheet(ProductionReportData report)
    {
        const int lastColumn = 6;
        var data = new SheetData();
        var merges = new MergeCells();
        AddRow(data, 1, At("A1", Text("TỔNG SẢN LƯỢNG THEO MÃ VÀ NGÀY", TitleStyle)));
        merges.Append(new MergeCell { Reference = $"A1:{Col(lastColumn)}1" });
        AddRow(data, 2, At("A2", Text($"Kỳ: {report.FromDate:dd/MM/yyyy} – {report.UntilDate:dd/MM/yyyy}", SectionStyle)));
        merges.Append(new MergeCell { Reference = $"A2:{Col(lastColumn)}2" });
        AddRow(data, 3);
        AddRow(data, 4,
            Text("Ngày", HeaderStyle),
            Text("Mã SX", HeaderStyle),
            Text("Sản phẩm", HeaderStyle),
            Text("HC", HcHeaderStyle),
            Text("TC", TcHeaderStyle),
            Text("Tổng", HeaderStyle));

        var row = 5U;
        foreach (var item in report.ByOrderAndDay)
        {
            AddRow(data, row++,
                Date(item.WorkDate),
                Text(item.ProductionOrderCode),
                Text(item.ProductName),
                HcNum(item.HcQuantity),
                TcNum(item.TcQuantity),
                Num(item.TotalQuantity));
        }

        if (report.ByOrderAndDay.Count == 0)
        {
            AddRow(data, row, At($"A{row}", Text("Không có dữ liệu trong kỳ đã chọn.", SectionStyle)));
            merges.Append(new MergeCell { Reference = $"A{row}:{Col(lastColumn)}{row}" });
        }
        else
        {
            AddRow(data, row,
                Text("TỔNG", SectionStyle),
                Text(string.Empty),
                Text(string.Empty),
                HcNum(report.ByOrderAndDay.Sum(item => item.HcQuantity)),
                TcNum(report.ByOrderAndDay.Sum(item => item.TcQuantity)),
                Num(report.ByOrderAndDay.Sum(item => item.TotalQuantity)));
        }

        return new Worksheet(
            new SheetProperties(new PageSetupProperties { FitToPage = true }),
            new SheetViews(new SheetView(new Pane
            {
                VerticalSplit = 4D,
                TopLeftCell = "A5",
                ActivePane = PaneValues.BottomRight,
                State = PaneStateValues.Frozen
            }) { WorkbookViewId = 0U }),
            new Columns(Column(1, 14), Column(2, 14), Column(3, 26), Column(4, 14), Column(5, 14), Column(6, 14)),
            data,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static Worksheet CreateCombinedWorksheet(ProductionReportData report)
    {
        var sections = new[]
        {
            CreateEmployeeDailyMatrixWorksheet(report),
            CreateWorkHoursWorksheet(report)
        };
        var data = new SheetData();
        var merges = new MergeCells();
        uint nextRow = 1U;
        foreach (var section in sections)
        {
            AppendWorksheetSection(data, merges, section, ref nextRow);
        }

        var matrix = sections[0];
        return new Worksheet(
            matrix.GetFirstChild<SheetProperties>()!.CloneNode(true),
            matrix.GetFirstChild<SheetViews>()!.CloneNode(true),
            matrix.GetFirstChild<Columns>()!.CloneNode(true),
            data,
            merges,
            matrix.GetFirstChild<PageMargins>()!.CloneNode(true),
            matrix.GetFirstChild<PageSetup>()!.CloneNode(true));
    }

    private static void AppendWorksheetSection(SheetData targetData, MergeCells targetMerges, Worksheet source, ref uint nextRow)
    {
        var sourceData = source.GetFirstChild<SheetData>();
        if (sourceData is null) return;

        var sourceRows = sourceData.Elements<Row>().ToArray();
        var sourceLastRow = sourceRows.Select(row => row.RowIndex?.Value ?? 0U).DefaultIfEmpty(0U).Max();
        var offset = nextRow - 1U;
        foreach (var sourceRow in sourceRows)
        {
            var row = (Row)sourceRow.CloneNode(true);
            var rowIndex = (row.RowIndex?.Value ?? 0U) + offset;
            row.RowIndex = rowIndex;
            foreach (var cell in row.Elements<Cell>())
            {
                if (cell.CellReference?.Value is { } reference)
                {
                    cell.CellReference = ShiftReference(reference, offset);
                }
            }
            targetData.Append(row);
        }

        var sourceMerges = source.GetFirstChild<MergeCells>();
        if (sourceMerges is not null)
        {
            foreach (var merge in sourceMerges.Elements<MergeCell>())
            {
                if (merge.Reference?.Value is { } reference)
                {
                    targetMerges.Append(new MergeCell { Reference = ShiftReference(reference, offset) });
                }
            }
        }

        nextRow = sourceLastRow + offset + 2U;
    }

    private static Worksheet CreateProductionWorksheet(ProductionReportData report)
    {
        const int metricsPerDay = 3;
        var days = Dates(report.FromDate, report.UntilDate)
            .Where(date => !report.ExcludeSundays || date.DayOfWeek != DayOfWeek.Sunday)
            .ToArray();
        var totalStart = 4 + days.Length * metricsPerDay;
        var lastColumn = totalStart + metricsPerDay - 1;
        var data = new SheetData();
        var merges = new MergeCells();
        AddRow(data, 1, At("A1", Text("TỔNG SẢN LƯỢNG THEO NHÂN VIÊN VÀ CÔNG ĐOẠN", TitleStyle)));
        merges.Append(new MergeCell { Reference = $"A1:{Col(lastColumn)}1" });
        AddRow(data, 2, At("A2", Text($"Kỳ: {report.FromDate:dd/MM/yyyy} – {report.UntilDate:dd/MM/yyyy}", SectionStyle)));
        merges.Append(new MergeCell { Reference = $"A2:{Col(lastColumn)}2" });
        AddRow(data, 3);
        AddCells(data, 4,
            At("A4", Text("Nhân viên", HeaderStyle)),
            At("B4", Text("CĐ", HeaderStyle)),
            At("C4", Text("ĐVT", HeaderStyle)));
        merges.Append(
            new MergeCell { Reference = "A4:A5" },
            new MergeCell { Reference = "B4:B5" },
            new MergeCell { Reference = "C4:C5" });
        for (var i = 0; i < days.Length; i++)
        {
            var start = 4 + i * metricsPerDay;
            AddCells(data, 4, At($"{Col(start)}4", Text(ManagementDateLabel(days[i]), HeaderStyle)));
            merges.Append(new MergeCell { Reference = $"{Col(start)}4:{Col(start + metricsPerDay - 1)}4" });
            AddCells(data, 5,
                At($"{Col(start)}5", Text("HC", HcHeaderStyle)),
                At($"{Col(start + 1)}5", Text("TC", TcHeaderStyle)),
                At($"{Col(start + 2)}5", Text("Tổng", HeaderStyle)));
        }
        AddCells(data, 4,
            At($"{Col(totalStart)}4", Text("Tổng HC", HcHeaderStyle)),
            At($"{Col(totalStart + 1)}4", Text("Tổng TC", TcHeaderStyle)),
            At($"{Col(totalStart + 2)}4", Text("Tổng", HeaderStyle)));
        for (var column = totalStart; column <= totalStart + 2; column++)
        {
            merges.Append(new MergeCell { Reference = $"{Col(column)}4:{Col(column)}5" });
        }

        var groups = report.Rows
            .GroupBy(item => new { item.EmployeeCode, item.EmployeeName, item.OperationNumber, item.Unit })
            .OrderBy(group => group.Key.EmployeeCode, StringComparer.Ordinal)
            .ThenBy(group => group.Key.EmployeeName, StringComparer.Ordinal)
            .ThenBy(group => group.Key.OperationNumber)
            .ThenBy(group => group.Key.Unit, StringComparer.Ordinal)
            .ToArray();
        var row = 6U;
        var employeeStartRow = 0U;
        string? currentEmployeeCode = null;
        string? currentEmployeeName = null;
        foreach (var group in groups)
        {
            var entries = group.ToArray();
            var first = entries[0];
            var isNewEmployee = !string.Equals(currentEmployeeCode, first.EmployeeCode, StringComparison.Ordinal)
                || !string.Equals(currentEmployeeName, first.EmployeeName, StringComparison.Ordinal);
            if (isNewEmployee)
            {
                if (employeeStartRow > 0U && employeeStartRow < row - 1U)
                {
                    merges.Append(new MergeCell { Reference = $"A{employeeStartRow}:A{row - 1U}" });
                }

                employeeStartRow = row;
                currentEmployeeCode = first.EmployeeCode;
                currentEmployeeName = first.EmployeeName;
            }
            var byDay = entries
                .GroupBy(item => item.WorkDate)
                .ToDictionary(item => item.Key, item => (Hc: item.Sum(value => value.HcQuantity), Tc: item.Sum(value => value.TcQuantity)));
            var isExternal = entries.All(item => item.IsExternal);
            var textStyle = isExternal ? ExternalTextStyle : 0U;
            var numberStyle = isExternal ? ExternalNumberStyle : NumericStyle;
            var cells = new List<Cell>
            {
                At($"A{row}", Text(isNewEmployee ? first.EmployeeName : string.Empty, textStyle)),
                At($"B{row}", Text($"CĐ{first.OperationNumber}", textStyle)),
                At($"C{row}", Text(first.Unit, textStyle))
            };
            for (var i = 0; i < days.Length; i++)
            {
                byDay.TryGetValue(days[i], out var quantity);
                cells.Add(At($"{Col(4 + i * metricsPerDay)}{row}", Num(quantity.Hc, isExternal ? ExternalNumberStyle : HcBodyStyle)));
                cells.Add(At($"{Col(5 + i * metricsPerDay)}{row}", Num(quantity.Tc, isExternal ? ExternalNumberStyle : TcBodyStyle)));
                cells.Add(At($"{Col(6 + i * metricsPerDay)}{row}", Num(quantity.Hc + quantity.Tc, numberStyle)));
            }
            var totalHc = entries.Sum(item => item.HcQuantity);
            var totalTc = entries.Sum(item => item.TcQuantity);
            cells.Add(At($"{Col(totalStart)}{row}", Num(totalHc, isExternal ? ExternalNumberStyle : HcBodyStyle)));
            cells.Add(At($"{Col(totalStart + 1)}{row}", Num(totalTc, isExternal ? ExternalNumberStyle : TcBodyStyle)));
            cells.Add(At($"{Col(totalStart + 2)}{row}", Num(totalHc + totalTc, numberStyle)));
            AddCells(data, row++, cells.ToArray());
        }

        if (employeeStartRow > 0U && employeeStartRow < row - 1U)
        {
            merges.Append(new MergeCell { Reference = $"A{employeeStartRow}:A{row - 1U}" });
        }

        if (groups.Length == 0)
        {
            AddRow(data, row, At($"A{row}", Text("Không có dữ liệu trong kỳ đã chọn.", SectionStyle)));
            merges.Append(new MergeCell { Reference = $"A{row}:{Col(lastColumn)}{row}" });
        }
        else
        {
            var totalHc = report.Rows.Sum(item => item.HcQuantity);
            var totalTc = report.Rows.Sum(item => item.TcQuantity);
            var cells = new List<Cell> { At($"A{row}", Text("TỔNG", SectionStyle)), At($"B{row}", Text(string.Empty)), At($"C{row}", Text(string.Empty)) };
            for (var i = 0; i < days.Length; i++)
            {
                var dayRows = report.Rows.Where(item => item.WorkDate == days[i]);
                var dayHc = dayRows.Sum(item => item.HcQuantity);
                var dayTc = dayRows.Sum(item => item.TcQuantity);
                cells.Add(At($"{Col(4 + i * metricsPerDay)}{row}", HcNum(dayHc)));
                cells.Add(At($"{Col(5 + i * metricsPerDay)}{row}", TcNum(dayTc)));
                cells.Add(At($"{Col(6 + i * metricsPerDay)}{row}", Num(dayHc + dayTc)));
            }
            cells.Add(At($"{Col(totalStart)}{row}", HcNum(totalHc)));
            cells.Add(At($"{Col(totalStart + 1)}{row}", TcNum(totalTc)));
            cells.Add(At($"{Col(totalStart + 2)}{row}", Num(totalHc + totalTc)));
            AddCells(data, row, cells.ToArray());
        }

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
            ProductionColumns(days.Length, totalStart),
            data,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static Worksheet CreateAttendanceWorksheet(ProductionReportData report)
    {
        const int metricsPerDay = 5;
        var days = Dates(report.FromDate, report.UntilDate)
            .Where(date => !report.ExcludeSundays || date.DayOfWeek != DayOfWeek.Sunday)
            .ToArray();
        var totalStart = 3 + days.Length * metricsPerDay;
        var lastColumn = totalStart + metricsPerDay + 1;
        var data = new SheetData();
        var merges = new MergeCells();
        AddRow(data, 1, At("A1", Text("BẢNG CÔNG THEO DÕI CÔNG", TitleStyle)));
        merges.Append(new MergeCell { Reference = $"A1:{Col(lastColumn)}1" });
        AddRow(data, 2, At("A2", Text($"Kỳ: {report.FromDate:dd/MM/yyyy} – {report.UntilDate:dd/MM/yyyy}", SectionStyle)));
        merges.Append(new MergeCell { Reference = $"A2:{Col(lastColumn)}2" });
        AddRow(data, 3);
        AddCells(data, 4, At("A4", Text("Mã NV", HeaderStyle)), At("B4", Text("Họ tên", HeaderStyle)));
        merges.Append(new MergeCell { Reference = "A4:A5" }, new MergeCell { Reference = "B4:B5" });
        for (var i = 0; i < days.Length; i++)
        {
            var start = 3 + i * metricsPerDay;
            AddCells(data, 4, At($"{Col(start)}4", Text(ManagementDateLabel(days[i]), HeaderStyle)));
            merges.Append(new MergeCell { Reference = $"{Col(start)}4:{Col(start + metricsPerDay - 1)}4" });
            AddCells(data, 5,
                At($"{Col(start)}5", Text("Giờ HC", HcHeaderStyle)),
                At($"{Col(start + 1)}5", Text("Giờ TC", TcHeaderStyle)),
                At($"{Col(start + 2)}5", Text("Giờ P", HeaderStyle)),
                At($"{Col(start + 3)}5", Text("Giờ Ô", HeaderStyle)),
                At($"{Col(start + 4)}5", Text("Tổng giờ", HeaderStyle)));
        }
        AddCells(data, 4, At($"{Col(totalStart)}4", Text("Tổng HC", HcHeaderStyle)), At($"{Col(totalStart + 1)}4", Text("Tổng TC", TcHeaderStyle)), At($"{Col(totalStart + 2)}4", Text("Tổng P", HeaderStyle)), At($"{Col(totalStart + 3)}4", Text("Tổng Ô", HeaderStyle)), At($"{Col(totalStart + 4)}4", Text("Tổng giờ", HeaderStyle)), At($"{Col(totalStart + 5)}4", Text("Ghi chú", HeaderStyle)));
        for (var column = totalStart; column <= totalStart + 5; column++)
        {
            merges.Append(new MergeCell { Reference = $"{Col(column)}4:{Col(column)}5" });
        }

        var employees = report.WorkHours
            .Select(item => (item.EmployeeCode, item.EmployeeName))
            .Distinct()
            .OrderBy(item => item.EmployeeCode, StringComparer.Ordinal)
            .ThenBy(item => item.EmployeeName, StringComparer.Ordinal)
            .ToArray();
        var byEmployeeDay = report.WorkHours.ToDictionary(item => (item.EmployeeCode, item.EmployeeName, item.WorkDate));
        var row = 6U;
        foreach (var employee in employees)
        {
            var cells = new List<Cell> { At($"A{row}", Text(employee.EmployeeCode)), At($"B{row}", Text(employee.EmployeeName)) };
            var totals = new decimal[metricsPerDay];
            var notes = new List<string>();
            for (var i = 0; i < days.Length; i++)
            {
                byEmployeeDay.TryGetValue((employee.EmployeeCode, employee.EmployeeName, days[i]), out var item);
                var values = new[] { item?.RegularHours ?? 0m, item?.OvertimeHours ?? 0m, item?.PaidLeaveHours ?? 0m, item?.SickLeaveHours ?? 0m, item?.TotalHours ?? 0m };
                for (var metric = 0; metric < metricsPerDay; metric++)
                {
                    totals[metric] += values[metric];
                    cells.Add(At($"{Col(3 + i * metricsPerDay + metric)}{row}", metric switch
                    {
                        0 => HcNum(values[metric]),
                        1 => TcNum(values[metric]),
                        _ => Num(values[metric])
                    }));
                }
                if (!string.IsNullOrWhiteSpace(item?.Note)) notes.Add($"{days[i]:dd/MM}: {item.Note}");
            }
            for (var metric = 0; metric < metricsPerDay; metric++)
            {
                cells.Add(At($"{Col(totalStart + metric)}{row}", metric switch
                {
                    0 => HcNum(totals[metric]),
                    1 => TcNum(totals[metric]),
                    _ => Num(totals[metric])
                }));
            }
            cells.Add(At($"{Col(totalStart + 5)}{row}", Text(string.Join("; ", notes))));
            AddCells(data, row++, cells.ToArray());
        }
        if (employees.Length == 0)
        {
            AddRow(data, row, At($"A{row}", Text("Không có dữ liệu chấm công trong kỳ đã chọn.", SectionStyle)));
            merges.Append(new MergeCell { Reference = $"A{row}:{Col(lastColumn)}{row}" });
        }

        return new Worksheet(
            new SheetProperties(new PageSetupProperties { FitToPage = true }),
            new SheetViews(new SheetView(new Pane
            {
                HorizontalSplit = 2D,
                VerticalSplit = 5D,
                TopLeftCell = "C6",
                ActivePane = PaneValues.BottomRight,
                State = PaneStateValues.Frozen
            }) { WorkbookViewId = 0U }),
            AttendanceSummaryColumns(days.Length, totalStart),
            data,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static Worksheet CreateEmployeeDailyMatrixWorksheet(ProductionReportData report)
    {
        const int metricsPerDay = 6;
        var days = Dates(report.FromDate, report.UntilDate)
            .Where(date => !report.ExcludeSundays || date.DayOfWeek != DayOfWeek.Sunday)
            .ToArray();
        var totalStart = 4 + days.Length * metricsPerDay;
        var lastColumn = totalStart + metricsPerDay - 1;
        var data = new SheetData();
        var merges = new MergeCells();
        AddRow(data, 1, At("A1", Text("TỔNG HỢP SẢN LƯỢNG VÀ GIỜ LÀM THEO NGÀY", TitleStyle)));
        merges.Append(new MergeCell { Reference = $"A1:{Col(lastColumn)}1" });
        AddRow(data, 2, At("A2", Text($"Kỳ: {report.FromDate:dd/MM/yyyy} – {report.UntilDate:dd/MM/yyyy}", SectionStyle)));
        merges.Append(new MergeCell { Reference = $"A2:{Col(lastColumn)}2" });
        AddRow(data, 3);
        AddCells(data, 4, At("A4", Text("Nhân viên", HeaderStyle)), At("B4", Text("CĐ", HeaderStyle)), At("C4", Text("ĐVT", HeaderStyle)));
        merges.Append(new MergeCell { Reference = "A4:A5" }, new MergeCell { Reference = "B4:B5" }, new MergeCell { Reference = "C4:C5" });
        for (var i = 0; i < days.Length; i++)
        {
            var start = 4 + i * metricsPerDay;
            AddCells(data, 4, At($"{Col(start)}4", Text(ManagementDateLabel(days[i]), HeaderStyle)));
            merges.Append(new MergeCell { Reference = $"{Col(start)}4:{Col(start + metricsPerDay - 1)}4" });
        }
        AddCells(data, 4, At($"{Col(totalStart)}4", Text("Tổng kỳ", HeaderStyle)));
        merges.Append(new MergeCell { Reference = $"{Col(totalStart)}4:{Col(lastColumn)}4" });

        var metricLabels = new[] { "Tổng SP", "HC SP", "TC SP", "Giờ HC", "Giờ TC", "Tổng giờ" };
        var metricCells = new[] { NumericStyle, HcHeaderStyle, TcHeaderStyle, HcHeaderStyle, TcHeaderStyle, HeaderStyle };
        var row5Cells = new List<Cell>();
        for (var i = 0; i < days.Length + 1; i++)
        {
            for (var metric = 0; metric < metricsPerDay; metric++)
            {
                row5Cells.Add(At($"{Col(4 + i * metricsPerDay + metric)}5", Text(metricLabels[metric], (uint)metricCells[metric])));
            }
        }
        AddCells(data, 5, row5Cells.ToArray());

        var employees = report.ByEmployeeAndDay
            .Select(item => (item.EmployeeCode, item.EmployeeName))
            .Concat(report.WorkHours.Select(item => (item.EmployeeCode, item.EmployeeName)))
            .Distinct()
            .OrderBy(item => item.EmployeeCode, StringComparer.Ordinal)
            .ThenBy(item => item.EmployeeName, StringComparer.Ordinal)
            .ToArray();
        var productionByEmployeeDay = report.ByEmployeeAndDay.ToDictionary(
            item => (item.EmployeeCode, item.EmployeeName, item.WorkDate));
        var hoursByEmployeeDay = report.WorkHours.ToDictionary(
            item => (item.EmployeeCode, item.EmployeeName, item.WorkDate));
        var employeeDetails = report.Rows
            .GroupBy(item => (item.EmployeeCode, item.EmployeeName))
            .ToDictionary(
                group => group.Key,
                group => (
                    Operations: string.Join(", ", group.Select(item => $"CĐ{item.OperationNumber}").Distinct().OrderBy(value => value, StringComparer.Ordinal)),
                    Units: string.Join(", ", group.Select(item => item.Unit).Distinct(StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal))));

        var row = 6U;
        foreach (var employee in employees)
        {
            employeeDetails.TryGetValue(employee, out var details);
            var employeeLabel = employee.EmployeeCode == "__EXTERNAL__"
                ? employee.EmployeeName
                : $"{employee.EmployeeCode} - {employee.EmployeeName}";
            var cells = new List<Cell>
            {
                At($"A{row}", Text(employeeLabel)),
                At($"B{row}", Text(details.Operations ?? string.Empty)),
                At($"C{row}", Text(details.Units ?? string.Empty))
            };
            var employeeTotals = new decimal[metricsPerDay];
            for (var i = 0; i < days.Length; i++)
            {
                productionByEmployeeDay.TryGetValue((employee.EmployeeCode, employee.EmployeeName, days[i]), out var production);
                hoursByEmployeeDay.TryGetValue((employee.EmployeeCode, employee.EmployeeName, days[i]), out var hours);
                var values = new[] { production?.TotalQuantity ?? 0m, production?.HcQuantity ?? 0m, production?.TcQuantity ?? 0m, hours?.RegularHours ?? 0m, hours?.OvertimeHours ?? 0m, hours?.TotalHours ?? 0m };
                for (var metric = 0; metric < metricsPerDay; metric++)
                {
                    employeeTotals[metric] += values[metric];
                    cells.Add(At($"{Col(4 + i * metricsPerDay + metric)}{row}", metric switch
                    {
                        1 or 3 => HcNum(values[metric]),
                        2 or 4 => TcNum(values[metric]),
                        _ => Num(values[metric])
                    }));
                }
            }
            for (var metric = 0; metric < metricsPerDay; metric++)
            {
                cells.Add(At($"{Col(totalStart + metric)}{row}", metric switch
                {
                    1 or 3 => HcNum(employeeTotals[metric]),
                    2 or 4 => TcNum(employeeTotals[metric]),
                    _ => Num(employeeTotals[metric])
                }));
            }
            AddCells(data, row++, cells.ToArray());
        }

        if (employees.Length == 0)
        {
            AddRow(data, row, At($"A{row}", Text("Không có dữ liệu trong kỳ đã chọn.", SectionStyle)));
            merges.Append(new MergeCell { Reference = $"A{row}:{Col(lastColumn)}{row}" });
        }
        else
        {
            var totalValues = new[]
            {
                report.ByEmployeeAndDay.Sum(item => item.TotalQuantity),
                report.ByEmployeeAndDay.Sum(item => item.HcQuantity),
                report.ByEmployeeAndDay.Sum(item => item.TcQuantity),
                report.WorkHours.Sum(item => item.RegularHours),
                report.WorkHours.Sum(item => item.OvertimeHours),
                report.WorkHours.Sum(item => item.TotalHours)
            };
            var totalCells = new List<Cell> { At($"A{row}", Text("TỔNG", SectionStyle)), At($"B{row}", Text(string.Empty)), At($"C{row}", Text(string.Empty)) };
            for (var i = 0; i < days.Length; i++)
            {
                var production = report.ByEmployeeAndDay.Where(item => item.WorkDate == days[i]);
                var hours = report.WorkHours.Where(item => item.WorkDate == days[i]);
                var values = new[] { production.Sum(item => item.TotalQuantity), production.Sum(item => item.HcQuantity), production.Sum(item => item.TcQuantity), hours.Sum(item => item.RegularHours), hours.Sum(item => item.OvertimeHours), hours.Sum(item => item.TotalHours) };
                for (var metric = 0; metric < metricsPerDay; metric++)
                {
                    totalCells.Add(At($"{Col(4 + i * metricsPerDay + metric)}{row}", metric switch
                    {
                        1 or 3 => HcNum(values[metric]),
                        2 or 4 => TcNum(values[metric]),
                        _ => Num(values[metric])
                    }));
                }
            }
            for (var metric = 0; metric < metricsPerDay; metric++)
            {
                totalCells.Add(At($"{Col(totalStart + metric)}{row}", metric switch
                {
                    1 or 3 => HcNum(totalValues[metric]),
                    2 or 4 => TcNum(totalValues[metric]),
                    _ => Num(totalValues[metric])
                }));
            }
            AddCells(data, row, totalCells.ToArray());
        }

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
            MatrixColumns(days.Length, totalStart),
            data,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static Columns MatrixColumns(int days, int totalStart)
    {
        var columns = new Columns(Column(1, 28), Column(2, 14), Column(3, 16));
        for (var i = 0; i < days * 6; i++) columns.Append(Column((uint)(3 + i), 12));
        for (var i = 0; i < 6; i++) columns.Append(Column((uint)(totalStart + i), 12));
        return columns;
    }

    private static Columns ProductionColumns(int days, int totalStart)
    {
        var columns = new Columns(Column(1, 28), Column(2, 10), Column(3, 12));
        for (var i = 0; i < days * 3; i++) columns.Append(Column((uint)(4 + i), 10));
        for (var i = 0; i < 3; i++) columns.Append(Column((uint)(totalStart + i), 12));
        return columns;
    }

    private static Columns AttendanceSummaryColumns(int days, int totalStart)
    {
        var columns = new Columns(Column(1, 12), Column(2, 26));
        for (var i = 0; i < days * 5; i++) columns.Append(Column((uint)(3 + i), 11));
        for (var i = 0; i < 5; i++) columns.Append(Column((uint)(totalStart + i), 12));
        columns.Append(Column((uint)(totalStart + 5), 30));
        return columns;
    }

    private static string ShiftReference(string reference, uint rowOffset)
    {
        var separator = reference.IndexOf(':');
        if (separator >= 0)
        {
            return $"{ShiftReference(reference[..separator], rowOffset)}:{ShiftReference(reference[(separator + 1)..], rowOffset)}";
        }

        var firstDigit = 0;
        while (firstDigit < reference.Length && char.IsLetter(reference[firstDigit])) firstDigit++;
        if (firstDigit == reference.Length || !uint.TryParse(reference[firstDigit..], out var row)) return reference;
        return $"{reference[..firstDigit]}{row + rowOffset}";
    }

    private static Worksheet CreateWorkHoursWorksheet(ProductionReportData report)
    {
        const int lastColumn = 9;
        var data = new SheetData();
        var merges = new MergeCells();
        AddRow(data, 1, At("A1", Text("BẢNG CÔNG THEO DÕI CÔNG", TitleStyle)));
        merges.Append(new MergeCell { Reference = $"A1:{Col(lastColumn)}1" });
        AddRow(data, 2, At("A2", Text($"Kỳ: {report.FromDate:dd/MM/yyyy} – {report.UntilDate:dd/MM/yyyy}", SectionStyle)));
        merges.Append(new MergeCell { Reference = $"A2:{Col(lastColumn)}2" });
        AddRow(data, 3);
        AddRow(data, 4,
            Text("Ngày", HeaderStyle),
            Text("Mã NV", HeaderStyle),
            Text("Họ tên", HeaderStyle),
            Text("Giờ HC", HcHeaderStyle),
            Text("Giờ TC", TcHeaderStyle),
            Text("Tổng giờ", HeaderStyle),
            Text("Giờ P", HeaderStyle),
            Text("Giờ Ô", HeaderStyle),
            Text("Ghi chú", HeaderStyle));

        var row = 5U;
        foreach (var item in report.WorkHours)
        {
            AddRow(data, row++,
                Date(item.WorkDate),
                Text(item.EmployeeCode),
                Text(item.EmployeeName),
                HcNum(item.RegularHours),
                TcNum(item.OvertimeHours),
                Num(item.TotalHours),
                Num(item.PaidLeaveHours),
                Num(item.SickLeaveHours),
                Text(item.Note));
        }

        if (report.WorkHours.Count == 0)
        {
            AddRow(data, row, At($"A{row}", Text("Không có dữ liệu giờ làm trong kỳ đã chọn.", SectionStyle)));
            merges.Append(new MergeCell { Reference = $"A{row}:{Col(lastColumn)}{row}" });
        }
        else
        {
            AddRow(data, row,
                Text("TỔNG", SectionStyle),
                Text(string.Empty),
                Text(string.Empty),
                HcNum(report.WorkHours.Sum(item => item.RegularHours)),
                TcNum(report.WorkHours.Sum(item => item.OvertimeHours)),
                Num(report.WorkHours.Sum(item => item.TotalHours)),
                Num(report.WorkHours.Sum(item => item.PaidLeaveHours)),
                Num(report.WorkHours.Sum(item => item.SickLeaveHours)),
                Text(string.Empty));
        }

        return new Worksheet(
            new SheetProperties(new PageSetupProperties { FitToPage = true }),
            new SheetViews(new SheetView(new Pane
            {
                VerticalSplit = 4D,
                TopLeftCell = "A5",
                ActivePane = PaneValues.BottomRight,
                State = PaneStateValues.Frozen
            }) { WorkbookViewId = 0U }),
            new Columns(Column(1, 14), Column(2, 14), Column(3, 24), Column(4, 12), Column(5, 12), Column(6, 12), Column(7, 12), Column(8, 12), Column(9, 28)),
            data,
            merges,
            new PageMargins { Left = 0.25D, Right = 0.25D, Top = 0.5D, Bottom = 0.5D, Header = 0.2D, Footer = 0.2D },
            new PageSetup { Orientation = OrientationValues.Landscape, FitToWidth = 1U, FitToHeight = 0U });
    }

    private static void AddRow(SheetData data, uint index, params Cell[] cells) { var row = new Row { RowIndex = index }; row.Append(cells); data.Append(row); }
    private static void AddCells(SheetData data, uint index, params Cell[] cells) { var row = data.Elements<Row>().SingleOrDefault(x => x.RowIndex?.Value == index) ?? new Row { RowIndex = index }; if (row.Parent is null) data.Append(row); row.Append(cells.OrderBy(x => ColumnNumber(x.CellReference?.Value))); }
    private static Cell At(string reference, Cell cell) { cell.CellReference = reference; return cell; }
    private static Cell Text(string value, uint style = 0U) => new() { DataType = CellValues.InlineString, StyleIndex = style, InlineString = new InlineString(new Text(value)) };
    private static Cell Num(decimal value, uint style = NumericStyle) => new() { StyleIndex = style, CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture)) };
    private static Cell Blank(uint style) => new() { StyleIndex = style };
    private static Cell HcNum(decimal value) => Num(value, HcBodyStyle);
    private static Cell TcNum(decimal value) => Num(value, TcBodyStyle);
    private static Cell ExternalNum(decimal value) => Num(value, ExternalNumberStyle);
    private static Cell Num(int value) => Num((decimal)value);
    private static Cell Date(DateOnly value) => new() { StyleIndex = DateStyle, CellValue = new CellValue(value.ToDateTime(TimeOnly.MinValue).ToOADate().ToString(CultureInfo.InvariantCulture)) };

    private static SheetViews FrozenManagementViews() => new(new SheetView(new Pane { HorizontalSplit = 3D, VerticalSplit = 5D, TopLeftCell = "D6", ActivePane = PaneValues.BottomRight, State = PaneStateValues.Frozen }) { WorkbookViewId = 0U });
    private static Columns ManagementColumns(int days, int totalStart) { var columns = new Columns(Column(1, 26), Column(2, 9), Column(3, 10)); for (var i = 0; i < days * 2; i++) columns.Append(Column((uint)(4 + i), 10)); columns.Append(Column((uint)totalStart, 12), Column((uint)totalStart + 1, 12), Column((uint)totalStart + 2, 12)); return columns; }
    private static Columns OverviewColumns() => new(Column(1, 18), Column(2, 22), Column(3, 14), Column(4, 22), Column(5, 22));
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
        var fills = new Fills(
            new Fill(new PatternFill { PatternType = PatternValues.None }),
            new Fill(new PatternFill { PatternType = PatternValues.Gray125 }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFD9EAF7" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFEAF4FB" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFFFE6CC" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FF9DC3E6" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFF4B183" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid }),
            new Fill(new PatternFill(new ForegroundColor { Rgb = "FFD9D2E9" }, new BackgroundColor { Indexed = 64U }) { PatternType = PatternValues.Solid })) { Count = 8U };
        var formatsForCells = new CellFormats(
            new CellFormat(),
            new CellFormat { NumberFormatId = 164U, ApplyNumberFormat = true },
            new CellFormat { FontId = 2U, ApplyFont = true },
            new CellFormat { FontId = 1U, FillId = 2U, ApplyFont = true, ApplyFill = true, ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Center } },
            new CellFormat { FontId = 1U, ApplyFont = true },
            new CellFormat { ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Right } },
            new CellFormat { ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Center } },
            new CellFormat { FillId = 3U, ApplyFill = true, ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Right } },
            new CellFormat { FillId = 4U, ApplyFill = true, ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Right } },
            new CellFormat { FontId = 1U, FillId = 5U, ApplyFont = true, ApplyFill = true, ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Center } },
            new CellFormat { FontId = 1U, FillId = 6U, ApplyFont = true, ApplyFill = true, ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Center } },
            new CellFormat { FillId = 7U, ApplyFill = true },
            new CellFormat { FillId = 7U, ApplyFill = true, ApplyAlignment = true, Alignment = new Alignment { Horizontal = HorizontalAlignmentValues.Right } })
        { Count = 13U };
        return new Stylesheet(formats, fonts, fills, new Borders(new Border()) { Count = 1U }, new CellStyleFormats(new CellFormat()) { Count = 1U }, formatsForCells);
    }
}
