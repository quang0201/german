# Docker + Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung export báo cáo sản lượng `.xlsx` cho Manager/Admin và đóng gói React + ASP.NET Core Minimal API vào một Docker container kết nối PostgreSQL remote qua `.env`.

**Architecture:** Giữ nguyên layered modular monolith. `German.Application` sở hữu report query/model và abstraction exporter; `German.Infrastructure` triển khai OpenXML; `German.Api` chỉ map Minimal API, authorization và file response. Docker build React bằng Bun, publish ASP.NET Core bằng .NET SDK, rồi chạy trên ASP.NET Core runtime image; Compose không tạo PostgreSQL local.

**Tech Stack:** .NET 10, ASP.NET Core Minimal API, EF Core 10.0.10, Npgsql/PostgreSQL, React 19.2.7, Bun 1.3.14, Tailwind CSS 4.3.0, `DocumentFormat.OpenXml` 3.5.1, Docker/Compose.

## Global Constraints

- Giữ dependency direction: `German.Domain <- German.Application <- German.Infrastructure`; `German.Api` reference Application + Infrastructure cho composition root.
- `German.Api/Endpoints` không được query EF Core/DbContext trực tiếp.
- Backend tiếp tục dùng ASP.NET Core Minimal API; không thêm MVC Controller.
- OpenXML implementation chỉ nằm trong `German.Infrastructure`.
- Chỉ `Manager` và `Admin` được export; Worker = 403, anonymous = 401.
- Export date range tối đa 366 ngày inclusive; không truyền ngày thì mặc định ngày UTC hiện tại để behavior trong container deterministic.
- Soft-deleted `ProductionEntry` không được xuất.
- PostgreSQL là remote; Compose không có database service.
- `.env` không commit; chỉ commit `.env.example`.
- Runtime container expose port `8080` và healthcheck gọi `/health`.
- Không thêm ClosedXML, EPPlus, NPOI hoặc package Excel khác.
- TDD bắt buộc: test đỏ trước, implementation tối thiểu sau, chạy xanh rồi commit.

---

## File Structure

### Files tạo mới

```text
src/backend/German.Application/Reports/ProductionReportFilter.cs
src/backend/German.Application/Reports/ProductionReportRow.cs
src/backend/German.Application/Reports/ProductionReportData.cs
src/backend/German.Application/Reports/IProductionReportExporter.cs
src/backend/German.Application/Reports/ProductionReportService.cs
src/backend/German.Infrastructure/Excel/OpenXmlProductionReportExporter.cs
src/backend/German.Api/Endpoints/ReportEndpoints.cs
tests/German.Application.Tests/Reports/ProductionReportServiceTests.cs
tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj
tests/German.Infrastructure.Tests/Excel/OpenXmlProductionReportExporterTests.cs
tests/German.Api.Tests/ReportExportApiTests.cs
Dockerfile
.dockerignore
compose.yaml
.env.example
src/frontend/bun.lock
```

### Files sửa

```text
German.sln
src/backend/German.Infrastructure/German.Infrastructure.csproj
src/backend/German.Infrastructure/DependencyInjection.cs
src/backend/German.Api/Program.cs
src/frontend/src/architecture.test.js
.github/workflows/ci.yml
README.md
```

`.gitignore` hiện đã có `.env`, `.env.*`, `!.env.example`; chỉ thay đổi nếu verification phát hiện rule này bị mất.

---

### Task 1: Application report query và validation

**Files:**
- Create: `src/backend/German.Application/Reports/ProductionReportFilter.cs`
- Create: `src/backend/German.Application/Reports/ProductionReportRow.cs`
- Create: `src/backend/German.Application/Reports/ProductionReportData.cs`
- Create: `src/backend/German.Application/Reports/IProductionReportExporter.cs`
- Create: `src/backend/German.Application/Reports/ProductionReportService.cs`
- Create/Test: `tests/German.Application.Tests/Reports/ProductionReportServiceTests.cs`

**Interfaces:**
- Consumes: `IGermanDbContext`, `TimeProvider`, existing production entities.
- Produces:

```csharp
public sealed record ProductionReportFilter(
    DateOnly? FromDate,
    DateOnly? UntilDate,
    Guid? EmployeeId,
    Guid? OrderId,
    Guid? OperationId);

public sealed record ProductionReportRow(
    DateOnly WorkDate,
    string EmployeeCode,
    string EmployeeName,
    string ProductionOrderCode,
    string ProductName,
    int OperationNumber,
    string OperationName,
    string Unit,
    decimal HcQuantity,
    decimal TcQuantity,
    decimal TotalQuantity,
    decimal? OvertimeHours,
    ProductionEntryMode EntryMode,
    string? Note);

public sealed record ProductionReportData(
    DateOnly FromDate,
    DateOnly UntilDate,
    IReadOnlyList<ProductionReportRow> Rows);

public interface IProductionReportExporter
{
    byte[] Export(ProductionReportData report);
}

public sealed class ProductionReportService(IGermanDbContext db, TimeProvider timeProvider)
{
    public Task<AppResult<ProductionReportData>> BuildAsync(
        ProductionReportFilter filter,
        CancellationToken cancellationToken);
}
```

- [ ] **Step 1: Viết test đỏ cho default date, mapping, validation và filters**

Tạo `ProductionReportServiceTests.cs` với helper deterministic:

```csharp
using German.Application.Reports;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Reports;

[TestClass]
public sealed class ProductionReportServiceTests
{
    [TestMethod]
    public async Task BuildAsync_DefaultsToUtcTodayAndMapsRows()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        var service = new ProductionReportService(
            db,
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 12, 3, 0, 0, TimeSpan.Zero)));

        var result = await service.BuildAsync(
            new ProductionReportFilter(null, null, null, null, null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(new DateOnly(2026, 8, 12), result.Value!.FromDate);
        Assert.AreEqual(new DateOnly(2026, 8, 12), result.Value.UntilDate);
        Assert.AreEqual(1, result.Value.Rows.Count);
        var row = result.Value.Rows[0];
        Assert.AreEqual("E001", row.EmployeeCode);
        Assert.AreEqual("Nguyễn Văn A", row.EmployeeName);
        Assert.AreEqual("0417", row.ProductionOrderCode);
        Assert.AreEqual("Túi 0417", row.ProductName);
        Assert.AreEqual(11, row.OperationNumber);
        Assert.AreEqual("May thân", row.OperationName);
        Assert.AreEqual("cái", row.Unit);
        Assert.AreEqual(100m, row.HcQuantity);
        Assert.AreEqual(20m, row.TcQuantity);
        Assert.AreEqual(120m, row.TotalQuantity);
        Assert.AreEqual(seed.Entry.OvertimeHours, row.OvertimeHours);
    }

    [TestMethod]
    public async Task BuildAsync_RejectsReversedDateRange()
    {
        await using var db = CreateDb();
        var service = new ProductionReportService(db, TimeProvider.System);

        var result = await service.BuildAsync(
            new ProductionReportFilter(
                new DateOnly(2026, 8, 13),
                new DateOnly(2026, 8, 12),
                null,
                null,
                null),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("reports.invalid_date_range", result.Error!.Code);
    }

    [TestMethod]
    public async Task BuildAsync_RejectsRangeLongerThan366Days()
    {
        await using var db = CreateDb();
        var service = new ProductionReportService(db, TimeProvider.System);

        var result = await service.BuildAsync(
            new ProductionReportFilter(
                new DateOnly(2025, 1, 1),
                new DateOnly(2026, 1, 2),
                null,
                null,
                null),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("reports.date_range_too_large", result.Error!.Code);
    }

    [TestMethod]
    public async Task BuildAsync_ExcludesSoftDeletedEntries()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, new DateOnly(2026, 8, 12));
        seed.Entry.IsDeleted = true;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = new ProductionReportService(db, TimeProvider.System);
        var result = await service.BuildAsync(
            new ProductionReportFilter(
                new DateOnly(2026, 8, 12),
                new DateOnly(2026, 8, 12),
                null,
                null,
                null),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(0, result.Value!.Rows.Count);
    }

    [TestMethod]
    public async Task BuildAsync_AppliesEmployeeOrderAndOperationFilters()
    {
        await using var db = CreateDb();
        var first = await SeedAsync(db, new DateOnly(2026, 8, 12));

        var employee2 = new Employee { EmployeeCode = "E002", FullName = "Nguyễn Văn B" };
        var order2 = new ProductionOrder
        {
            Code = "0521",
            ProductName = "Túi 0521",
            PlannedQuantity = 500m,
            Status = ProductionOrderStatus.InProduction
        };
        var operation2 = new ProductionOperation
        {
            ProductionOrderId = order2.Id,
            OperationNumber = 6,
            Name = "Đóng gói",
            Unit = "thùng",
            SortOrder = 1
        };
        var account2 = new UserAccount
        {
            Username = "worker2",
            NormalizedUsername = "WORKER2",
            PasswordHash = "test",
            Role = UserRole.Worker,
            EmployeeId = employee2.Id
        };
        var entry2 = new ProductionEntry
        {
            WorkDate = new DateOnly(2026, 8, 12),
            EmployeeId = employee2.Id,
            ProductionOrderId = order2.Id,
            ProductionOperationId = operation2.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 30m,
            DirectTcQuantity = 0m,
            HcQuantity = 30m,
            TcQuantity = 0m,
            TotalQuantity = 30m,
            SubmittedByUserId = account2.Id
        };
        db.AddRange(employee2, order2, operation2, account2, entry2);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = new ProductionReportService(db, TimeProvider.System);
        var result = await service.BuildAsync(
            new ProductionReportFilter(
                new DateOnly(2026, 8, 12),
                new DateOnly(2026, 8, 12),
                first.Employee.Id,
                first.Order.Id,
                first.Operation.Id),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.AreEqual(1, result.Value!.Rows.Count);
        Assert.AreEqual("E001", result.Value.Rows[0].EmployeeCode);
        Assert.AreEqual("0417", result.Value.Rows[0].ProductionOrderCode);
        Assert.AreEqual(11, result.Value.Rows[0].OperationNumber);
    }

    private static GermanDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }

    private static async Task<SeedData> SeedAsync(GermanDbContext db, DateOnly date)
    {
        var employee = new Employee { EmployeeCode = "E001", FullName = "Nguyễn Văn A" };
        var order = new ProductionOrder
        {
            Code = "0417",
            ProductName = "Túi 0417",
            PlannedQuantity = 1000m,
            Status = ProductionOrderStatus.InProduction
        };
        var operation = new ProductionOperation
        {
            ProductionOrderId = order.Id,
            OperationNumber = 11,
            Name = "May thân",
            Unit = "cái",
            SortOrder = 1
        };
        var account = new UserAccount
        {
            Username = "worker1",
            NormalizedUsername = "WORKER1",
            PasswordHash = "test",
            Role = UserRole.Worker,
            EmployeeId = employee.Id
        };
        var entry = new ProductionEntry
        {
            WorkDate = date,
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 100m,
            DirectTcQuantity = 20m,
            OvertimeHours = 2m,
            HcQuantity = 100m,
            TcQuantity = 20m,
            TotalQuantity = 120m,
            SubmittedByUserId = account.Id,
            Note = "Ca chiều"
        };
        db.AddRange(employee, order, operation, account, entry);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return new SeedData(employee, order, operation, entry);
    }

    private sealed record SeedData(
        Employee Employee,
        ProductionOrder Order,
        ProductionOperation Operation,
        ProductionEntry Entry);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận RED**

Run:

```bash
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj \
  --configuration Release \
  --filter FullyQualifiedName~ProductionReportServiceTests
```

Expected: FAIL compile vì `German.Application.Reports` chưa tồn tại.

- [ ] **Step 3: Implement report models và service**

`BuildAsync` resolve ngày và validate chính xác:

```csharp
public async Task<AppResult<ProductionReportData>> BuildAsync(
    ProductionReportFilter filter,
    CancellationToken cancellationToken)
{
    var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
    var fromDate = filter.FromDate ?? filter.UntilDate ?? today;
    var untilDate = filter.UntilDate ?? filter.FromDate ?? today;

    if (fromDate > untilDate)
    {
        return AppResult<ProductionReportData>.Failure(
            "reports.invalid_date_range",
            "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
    }

    if (untilDate.DayNumber - fromDate.DayNumber > 365)
    {
        return AppResult<ProductionReportData>.Failure(
            "reports.date_range_too_large",
            "Khoảng thời gian export tối đa là 366 ngày.");
    }

    var entries = db.ProductionEntries.AsNoTracking()
        .Where(x => x.WorkDate >= fromDate && x.WorkDate <= untilDate);

    if (filter.EmployeeId.HasValue)
        entries = entries.Where(x => x.EmployeeId == filter.EmployeeId.Value);
    if (filter.OrderId.HasValue)
        entries = entries.Where(x => x.ProductionOrderId == filter.OrderId.Value);
    if (filter.OperationId.HasValue)
        entries = entries.Where(x => x.ProductionOperationId == filter.OperationId.Value);

    var rows = await (
        from entry in entries
        join employee in db.Employees.AsNoTracking() on entry.EmployeeId equals employee.Id
        join order in db.ProductionOrders.AsNoTracking() on entry.ProductionOrderId equals order.Id
        join operation in db.ProductionOperations.AsNoTracking() on entry.ProductionOperationId equals operation.Id
        orderby entry.WorkDate, employee.EmployeeCode, order.Code, operation.OperationNumber
        select new ProductionReportRow(
            entry.WorkDate,
            employee.EmployeeCode,
            employee.FullName,
            order.Code,
            order.ProductName,
            operation.OperationNumber,
            operation.Name,
            operation.Unit,
            entry.HcQuantity,
            entry.TcQuantity,
            entry.TotalQuantity,
            entry.OvertimeHours,
            entry.EntryMode,
            entry.Note))
        .ToListAsync(cancellationToken);

    return AppResult<ProductionReportData>.Success(
        new ProductionReportData(fromDate, untilDate, rows));
}
```

Không gọi `IgnoreQueryFilters()`: global query filter hiện có trên `ProductionEntry` phải tiếp tục loại soft-deleted rows.

- [ ] **Step 4: Chạy Application suite**

Run:

```bash
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --configuration Release
```

Expected: PASS toàn bộ Application tests.

- [ ] **Step 5: Commit**

```bash
git add src/backend/German.Application/Reports tests/German.Application.Tests/Reports
git commit -m "feat: add production report query"
```

---

### Task 2: OpenXML exporter trong Infrastructure

**Files:**
- Modify: `src/backend/German.Infrastructure/German.Infrastructure.csproj`
- Modify: `src/backend/German.Infrastructure/DependencyInjection.cs`
- Create: `src/backend/German.Infrastructure/Excel/OpenXmlProductionReportExporter.cs`
- Create: `tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj`
- Create/Test: `tests/German.Infrastructure.Tests/Excel/OpenXmlProductionReportExporterTests.cs`
- Modify: `German.sln`

**Interfaces:**
- Consumes: `IProductionReportExporter`, `ProductionReportData`.
- Produces: `OpenXmlProductionReportExporter : IProductionReportExporter`.

- [ ] **Step 1: Tạo Infrastructure test project**

Tạo project file:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="MSTest.TestAdapter" Version="3.6.4" />
    <PackageReference Include="MSTest.TestFramework" Version="3.6.4" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\src\backend\German.Infrastructure\German.Infrastructure.csproj" />
    <ProjectReference Include="..\..\src\backend\German.Application\German.Application.csproj" />
  </ItemGroup>
</Project>
```

Add vào solution:

```bash
dotnet sln German.sln add tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj
```

- [ ] **Step 2: Thêm OpenXML package reference để test project có thể parse workbook, nhưng chưa tạo exporter**

Trong `German.Infrastructure.csproj` thêm đúng package đã duyệt:

```xml
<PackageReference Include="DocumentFormat.OpenXml" Version="3.5.1" />
```

- [ ] **Step 3: Viết exporter tests trước implementation**

Tạo `OpenXmlProductionReportExporterTests.cs`:

```csharp
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
    public void Export_CreatesWorkbookWithProductionSheetAndHeaders()
    {
        var exporter = new OpenXmlProductionReportExporter();
        var bytes = exporter.Export(CreateReport([CreateRow()]));

        using var stream = new MemoryStream(bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheet = document.WorkbookPart!.Workbook.Sheets!.Elements<Sheet>().Single();
        Assert.AreEqual("Sản lượng", sheet.Name!.Value);

        var worksheetPart = (WorksheetPart)document.WorkbookPart.GetPartById(sheet.Id!);
        var firstRow = worksheetPart.Worksheet.GetFirstChild<SheetData>()!.Elements<Row>().First();
        var headers = firstRow.Elements<Cell>().Select(ReadText).ToArray();
        CollectionAssert.AreEqual(new[]
        {
            "Ngày", "Mã NV", "Họ tên", "Mã SX", "Sản phẩm", "CĐ", "Tên công đoạn",
            "Đơn vị", "HC", "TC", "Tổng", "Giờ TC", "Kiểu nhập", "Ghi chú"
        }, headers);
    }

    [TestMethod]
    public void Export_WritesQuantitiesAsNumericCells()
    {
        var exporter = new OpenXmlProductionReportExporter();
        var bytes = exporter.Export(CreateReport([CreateRow()]));

        using var stream = new MemoryStream(bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheet = document.WorkbookPart!.Workbook.Sheets!.Elements<Sheet>().Single();
        var worksheetPart = (WorksheetPart)document.WorkbookPart.GetPartById(sheet.Id!);
        var dataRow = worksheetPart.Worksheet.GetFirstChild<SheetData>()!.Elements<Row>().Skip(1).Single();
        var cells = dataRow.Elements<Cell>().ToArray();

        Assert.IsNull(cells[8].DataType?.Value);
        Assert.IsNull(cells[9].DataType?.Value);
        Assert.IsNull(cells[10].DataType?.Value);
        Assert.IsNull(cells[11].DataType?.Value);
        Assert.AreEqual("100", cells[8].CellValue!.Text);
        Assert.AreEqual("20", cells[9].CellValue!.Text);
        Assert.AreEqual("120", cells[10].CellValue!.Text);
        Assert.AreEqual("2", cells[11].CellValue!.Text);
    }

    [TestMethod]
    public void Export_EmptyRowsStillCreatesValidWorkbook()
    {
        var exporter = new OpenXmlProductionReportExporter();
        var bytes = exporter.Export(CreateReport([]));

        using var stream = new MemoryStream(bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheet = document.WorkbookPart!.Workbook.Sheets!.Elements<Sheet>().Single();
        var worksheetPart = (WorksheetPart)document.WorkbookPart.GetPartById(sheet.Id!);
        var rows = worksheetPart.Worksheet.GetFirstChild<SheetData>()!.Elements<Row>().ToArray();

        Assert.AreEqual(1, rows.Length);
        Assert.AreEqual("A1:N1", worksheetPart.Worksheet.GetFirstChild<AutoFilter>()!.Reference!.Value);
    }

    private static ProductionReportData CreateReport(IReadOnlyList<ProductionReportRow> rows) =>
        new(new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 12), rows);

    private static ProductionReportRow CreateRow() => new(
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
        "Ca chiều");

    private static string ReadText(Cell cell) =>
        cell.InlineString?.Text?.Text ?? cell.CellValue?.Text ?? string.Empty;
}
```

- [ ] **Step 4: Chạy exporter tests để xác nhận RED**

Run:

```bash
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --configuration Release
```

Expected: FAIL compile vì `OpenXmlProductionReportExporter` chưa tồn tại.

- [ ] **Step 5: Implement `OpenXmlProductionReportExporter`**

Exporter tạo workbook theo cấu trúc sau; không dùng shared string table:

```csharp
using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Reports;

namespace German.Infrastructure.Excel;

public sealed class OpenXmlProductionReportExporter : IProductionReportExporter
{
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
            AddStyles(workbookPart);

            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            var sheetData = new SheetData();
            var sheetView = new SheetView
            {
                WorkbookViewId = 0U
            };
            sheetView.Append(new Pane
            {
                VerticalSplit = 1D,
                TopLeftCell = "A2",
                ActivePane = PaneValues.BottomLeft,
                State = PaneStateValues.Frozen
            });

            var worksheet = new Worksheet(
                new SheetViews(sheetView),
                CreateColumns(),
                sheetData);
            worksheetPart.Worksheet = worksheet;

            sheetData.Append(CreateHeaderRow());
            uint rowIndex = 2;
            foreach (var row in report.Rows)
            {
                sheetData.Append(CreateDataRow(row, rowIndex));
                rowIndex++;
            }

            var lastRow = Math.Max(1U, rowIndex - 1);
            worksheet.Append(new AutoFilter { Reference = $"A1:N{lastRow}" });

            var sheets = workbookPart.Workbook.AppendChild(new Sheets());
            sheets.Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = 1U,
                Name = "Sản lượng"
            });

            worksheetPart.Worksheet.Save();
            workbookPart.Workbook.Save();
        }

        return stream.ToArray();
    }

    private static Row CreateHeaderRow()
    {
        var row = new Row { RowIndex = 1U };
        foreach (var header in Headers)
            row.Append(TextCell(header, 1U));
        return row;
    }

    private static Row CreateDataRow(ProductionReportRow item, uint rowIndex)
    {
        var row = new Row { RowIndex = rowIndex };
        row.Append(
            NumberCell(item.WorkDate.ToDateTime(TimeOnly.MinValue).ToOADate(), 2U),
            TextCell(item.EmployeeCode),
            TextCell(item.EmployeeName),
            TextCell(item.ProductionOrderCode),
            TextCell(item.ProductName),
            NumberCell(item.OperationNumber),
            TextCell(item.OperationName),
            TextCell(item.Unit),
            NumberCell(item.HcQuantity),
            NumberCell(item.TcQuantity),
            NumberCell(item.TotalQuantity),
            item.OvertimeHours.HasValue ? NumberCell(item.OvertimeHours.Value) : TextCell(string.Empty),
            TextCell(item.EntryMode.ToString()),
            TextCell(item.Note ?? string.Empty));
        return row;
    }

    private static Cell TextCell(string value, uint styleIndex = 0U) => new()
    {
        DataType = CellValues.InlineString,
        StyleIndex = styleIndex,
        InlineString = new InlineString(new Text(value))
    };

    private static Cell NumberCell(decimal value, uint styleIndex = 0U) => new()
    {
        StyleIndex = styleIndex,
        CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture))
    };

    private static Cell NumberCell(double value, uint styleIndex = 0U) => new()
    {
        StyleIndex = styleIndex,
        CellValue = new CellValue(value.ToString(CultureInfo.InvariantCulture))
    };

    private static Columns CreateColumns() => new(
        new Column { Min = 1U, Max = 1U, Width = 13D, CustomWidth = true },
        new Column { Min = 2U, Max = 2U, Width = 12D, CustomWidth = true },
        new Column { Min = 3U, Max = 3U, Width = 24D, CustomWidth = true },
        new Column { Min = 4U, Max = 4U, Width = 12D, CustomWidth = true },
        new Column { Min = 5U, Max = 5U, Width = 24D, CustomWidth = true },
        new Column { Min = 6U, Max = 6U, Width = 8D, CustomWidth = true },
        new Column { Min = 7U, Max = 7U, Width = 28D, CustomWidth = true },
        new Column { Min = 8U, Max = 8U, Width = 12D, CustomWidth = true },
        new Column { Min = 9U, Max = 12U, Width = 12D, CustomWidth = true },
        new Column { Min = 13U, Max = 13U, Width = 18D, CustomWidth = true },
        new Column { Min = 14U, Max = 14U, Width = 30D, CustomWidth = true });

    private static void AddStyles(WorkbookPart workbookPart)
    {
        var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
        var numberingFormats = new NumberingFormats(
            new NumberingFormat { NumberFormatId = 164U, FormatCode = "dd/mm/yyyy" })
        { Count = 1U };
        var fonts = new Fonts(
            new Font(),
            new Font(new Bold()))
        { Count = 2U };
        var fills = new Fills(
            new Fill(new PatternFill { PatternType = PatternValues.None }),
            new Fill(new PatternFill { PatternType = PatternValues.Gray125 }))
        { Count = 2U };
        var borders = new Borders(new Border()) { Count = 1U };
        var cellStyleFormats = new CellStyleFormats(new CellFormat()) { Count = 1U };
        var cellFormats = new CellFormats(
            new CellFormat(),
            new CellFormat { FontId = 1U, ApplyFont = true },
            new CellFormat { NumberFormatId = 164U, ApplyNumberFormat = true })
        { Count = 3U };

        stylesPart.Stylesheet = new Stylesheet(
            numberingFormats,
            fonts,
            fills,
            borders,
            cellStyleFormats,
            cellFormats);
        stylesPart.Stylesheet.Save();
    }
}
```

Nếu OpenXML validator/build phản ánh thứ tự child element của `Stylesheet`, giữ nguyên semantic trên nhưng sắp xếp element theo schema yêu cầu; không bỏ style/test.

- [ ] **Step 6: Đăng ký exporter DI**

Trong `DependencyInjection.cs` thêm:

```csharp
using German.Application.Reports;
using German.Infrastructure.Excel;
```

và trong `AddGermanInfrastructure`:

```csharp
services.AddSingleton<IProductionReportExporter, OpenXmlProductionReportExporter>();
```

- [ ] **Step 7: Chạy Infrastructure tests + backend build**

Run:

```bash
dotnet restore German.sln
dotnet build German.sln --no-restore --configuration Release
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-build --configuration Release
```

Expected: build PASS, exporter tests PASS.

- [ ] **Step 8: Commit**

```bash
git add German.sln src/backend/German.Infrastructure tests/German.Infrastructure.Tests
git commit -m "feat: export production reports with OpenXML"
```

---

### Task 3: Minimal API report endpoint + authorization

**Files:**
- Create: `src/backend/German.Api/Endpoints/ReportEndpoints.cs`
- Modify: `src/backend/German.Api/Program.cs`
- Create/Test: `tests/German.Api.Tests/ReportExportApiTests.cs`

**Interfaces:**
- Consumes: `ProductionReportService.BuildAsync`, `IProductionReportExporter.Export`, existing `ManagerOrAdmin` policy.
- Produces: `GET /api/reports/production/export.xlsx`.

- [ ] **Step 1: Viết API integration tests trước endpoint**

Tạo test class với 5 cases. Dùng helper account/password giống production hashing, nhưng đặt helper đầy đủ trong file mới:

```csharp
using System.Net;
using System.Net.Http.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ReportExportApiTests
{
    [TestMethod]
    public async Task Export_Anonymous_ReturnsUnauthorized()
    {
        await using var factory = new GermanApiFactory();
        using var client = factory.CreateClient(new() { HandleCookies = true });
        var response = await client.GetAsync("/api/reports/production/export.xlsx?fromDate=2026-08-12&untilDate=2026-08-12");
        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task Export_Worker_ReturnsForbidden()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "worker", "E001", UserRole.Worker, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "worker", "secret");

        var response = await client.GetAsync("/api/reports/production/export.xlsx?fromDate=2026-08-12&untilDate=2026-08-12");
        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [TestMethod]
    public async Task Export_Manager_ReturnsXlsx()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "manager", "M001", UserRole.Manager, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager", "secret");

        var response = await client.GetAsync("/api/reports/production/export.xlsx?fromDate=2026-08-12&untilDate=2026-08-12");
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.AreEqual(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            response.Content.Headers.ContentType!.MediaType);
        Assert.IsTrue((await response.Content.ReadAsByteArrayAsync()).Length > 0);
    }

    [TestMethod]
    public async Task Export_Admin_ReturnsXlsx()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "admin", "A001", UserRole.Admin, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "admin", "secret");

        var response = await client.GetAsync("/api/reports/production/export.xlsx?fromDate=2026-08-12&untilDate=2026-08-12");
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [TestMethod]
    public async Task Export_InvalidDateRange_ReturnsBadRequest()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "manager", "M002", UserRole.Manager, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager", "secret");

        var response = await client.GetAsync("/api/reports/production/export.xlsx?fromDate=2026-08-13&untilDate=2026-08-12");
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task SeedAccountAsync(
        GermanApiFactory factory,
        string username,
        string employeeCode,
        UserRole role,
        string password)
    {
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var passwordService = services.GetRequiredService<IPasswordService>();
            var employee = new Employee { EmployeeCode = employeeCode, FullName = username };
            var account = new UserAccount
            {
                Username = username,
                NormalizedUsername = username.ToUpperInvariant(),
                Role = role,
                EmployeeId = employee.Id
            };
            account.PasswordHash = passwordService.HashPassword(account, password);
            db.AddRange(employee, account);
            await db.SaveChangesAsync();
        });
    }

    private static async Task LoginAsync(HttpClient client, string identifier, string password)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { identifier, password });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận RED**

Run:

```bash
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj \
  --configuration Release \
  --filter FullyQualifiedName~ReportExportApiTests
```

Expected: anonymous case có thể 404 trước khi route tồn tại; các success/authorization cases không đạt expected contract.

- [ ] **Step 3: Implement Minimal API endpoint**

Tạo `ReportEndpoints.cs`:

```csharp
using German.Application.Reports;

namespace German.Api.Endpoints;

public static class ReportEndpoints
{
    private const string XlsxContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/reports")
            .RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/production/export.xlsx", ExportProductionAsync);
        return endpoints;
    }

    private static async Task<IResult> ExportProductionAsync(
        DateOnly? fromDate,
        DateOnly? untilDate,
        Guid? employeeId,
        Guid? orderId,
        Guid? operationId,
        ProductionReportService service,
        IProductionReportExporter exporter,
        CancellationToken cancellationToken)
    {
        var result = await service.BuildAsync(
            new ProductionReportFilter(fromDate, untilDate, employeeId, orderId, operationId),
            cancellationToken);

        if (!result.IsSuccess)
            return ApiResultMapper.Error(result.Error!);

        var report = result.Value!;
        var bytes = exporter.Export(report);
        var fileName = $"san-luong_{report.FromDate:yyyyMMdd}_{report.UntilDate:yyyyMMdd}.xlsx";
        return Results.File(bytes, XlsxContentType, fileName);
    }
}
```

- [ ] **Step 4: Đăng ký service và endpoint trong `Program.cs`**

Thêm service registrations:

```csharp
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ProductionReportService>();
```

Thêm route trước `MapFallbackToFile`:

```csharp
app.MapReportEndpoints();
```

Không reference `DocumentFormat.OpenXml` hoặc `OpenXmlProductionReportExporter` trực tiếp trong API.

- [ ] **Step 5: Chạy API suite + full backend tests**

Run:

```bash
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --configuration Release
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --configuration Release
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --configuration Release
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --configuration Release
```

Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/backend/German.Api tests/German.Api.Tests
git commit -m "feat: add authorized production Excel endpoint"
```

---

### Task 4: Architecture guardrails cho report dependency

**Files:**
- Modify/Test: `src/frontend/src/architecture.test.js`

**Interfaces:**
- Consumes: repository source tree.
- Produces: CI guardrail ngăn OpenXML/persistence leak ra Application/API endpoints.

- [ ] **Step 1: Bổ sung test guardrail**

Thêm test:

```javascript
test("report export keeps OpenXML in Infrastructure", () => {
  const files = [
    ...csFiles("src/backend/German.Application/Reports"),
    ...csFiles("src/backend/German.Api/Endpoints"),
  ];
  const violations = files.filter((path) =>
    read(path).includes("DocumentFormat.OpenXml"),
  );
  expect(violations).toEqual([]);
});
```

Giữ test endpoint hiện tại cấm `Microsoft.EntityFrameworkCore`, `IGermanDbContext`, `German.Application.Abstractions` trong `German.Api/Endpoints`.

- [ ] **Step 2: Chạy architecture tests**

Run:

```bash
cd src/frontend
bun test src/architecture.test.js
```

Expected: PASS. Nếu fail, sửa dependency boundary trong production code; không bỏ forbidden token khỏi test.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/architecture.test.js
git commit -m "test: enforce report architecture boundaries"
```

---

### Task 5: Reproducible frontend lockfile + production Docker image

**Files:**
- Create: `src/frontend/bun.lock`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `compose.yaml`
- Create: `.env.example`
- Verify: `.gitignore`

**Interfaces:**
- Consumes: existing `bun run build`, `German.Api` publish, `ConnectionStrings__German`, bootstrap admin environment variables.
- Produces: one `german-app` image/service at port 8080.

- [ ] **Step 1: Generate Bun lockfile**

Repo hiện chưa có Bun lockfile. Run:

```bash
cd src/frontend
bun install
bun install --frozen-lockfile
cd ../..
```

Expected: `src/frontend/bun.lock` tồn tại; lệnh frozen install PASS; dependency versions trong `package.json` không thay đổi.

- [ ] **Step 2: Tạo `Dockerfile` multi-stage**

```dockerfile
FROM oven/bun:1.3.14 AS frontend-build
WORKDIR /src/frontend
COPY src/frontend/package.json src/frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY src/frontend/ ./
RUN bun run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY . .
RUN dotnet restore German.sln
COPY --from=frontend-build /src/frontend/dist ./src/backend/German.Api/wwwroot
RUN dotnet publish src/backend/German.Api/German.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend-build /app/publish ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "German.Api.dll"]
```

Không copy `.env` vào image.

- [ ] **Step 3: Tạo `.dockerignore`**

```text
.git
.github
.worktrees
**/bin
**/obj
**/node_modules
src/frontend/dist
src/backend/German.Api/wwwroot
.env
.env.*
!.env.example
```

- [ ] **Step 4: Tạo `.env.example`**

```text
APP_PORT=8080
ConnectionStrings__German=Host=db.example.com;Port=5432;Database=german;Username=german;Password=change-me;SSL Mode=Require
BootstrapAdmin__Enabled=false
BootstrapAdmin__Username=admin
BootstrapAdmin__Password=change-me
```

Verification bắt buộc:

```bash
git check-ignore .env
git check-ignore -v .env.example || true
```

Expected: `.env` bị ignore; `.env.example` không bị ignore.

- [ ] **Step 5: Tạo `compose.yaml` chỉ với app service**

```yaml
services:
  german-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${APP_PORT:-8080}:8080"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "--fail", "--silent", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
```

Không thêm database service, volume hoặc local PostgreSQL credentials.

- [ ] **Step 6: Verify Docker build/config**

Run:

```bash
cp .env.example .env
docker compose config >/dev/null
docker build -t german:local .
rm .env
```

Expected: Compose config PASS; Docker build PASS; `git status --short` không liệt kê `.env`.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile .dockerignore compose.yaml .env.example src/frontend/bun.lock
git commit -m "build: add production Docker runtime"
```

---

### Task 6: CI Docker validation + documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: Docker artifacts, all test projects.
- Produces: CI gate + operator instructions.

- [ ] **Step 1: Bổ sung Infrastructure tests vào backend CI**

Sau Application test step thêm:

```yaml
      - name: Test infrastructure
        run: dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-build --configuration Release
```

- [ ] **Step 2: Thêm Docker CI job**

```yaml
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Validate Compose
        run: |
          cp .env.example .env
          docker compose config >/dev/null
      - name: Build image
        run: docker build -t german:ci .
```

Không startup app trong CI vì app startup hiện migrate PostgreSQL và cần remote DB thật; build/config validation không cần secret.

- [ ] **Step 3: Cập nhật README cho Docker**

README phải chứa đúng operator flow:

```bash
cp .env.example .env
# sửa ConnectionStrings__German và BootstrapAdmin nếu cần
docker compose up -d --build
docker compose logs -f german-app
docker compose down
```

Nêu rõ:
- PostgreSQL phải reachable từ host chạy Docker.
- Không commit `.env`.
- App tự chạy EF migration khi startup.
- `APP_PORT` mặc định `8080`.

- [ ] **Step 4: Cập nhật README cho Excel export**

Document endpoint và query:

```text
GET /api/reports/production/export.xlsx
?fromDate=2026-08-01
&untilDate=2026-08-12
&employeeId=<guid>
&orderId=<guid>
&operationId=<guid>
```

Nêu rõ `employeeId`, `orderId`, `operationId` optional; Manager/Admin only; max 366 ngày; bỏ cả `fromDate` và `untilDate` thì server dùng ngày UTC hiện tại.

- [ ] **Step 5: Run full verification**

Run:

```bash
dotnet restore German.sln
dotnet build German.sln --no-restore --configuration Release
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --no-build --configuration Release
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-build --configuration Release
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-build --configuration Release
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-build --configuration Release
cd src/frontend
bun install --frozen-lockfile
bun test
bun run build
cd ../..
cp .env.example .env
docker compose config >/dev/null
docker build -t german:verify .
rm .env
```

Expected:
- .NET build PASS, 0 errors.
- Domain/Application/Infrastructure/API tests PASS.
- Bun tests + architecture tests PASS.
- Frontend build PASS.
- Compose config PASS.
- Docker image build PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: verify Docker and Excel export"
```

---

### Task 7: Final branch verification và review handoff

**Files:**
- No planned production changes; chỉ sửa nếu verification tìm thấy defect cụ thể.

**Interfaces:**
- Consumes: toàn feature branch.
- Produces: branch sẵn sàng review/merge vào `dev`; không merge `main`.

- [ ] **Step 1: Review diff theo architecture contract**

Run:

```bash
git diff dev...HEAD -- \
  src/backend \
  src/frontend/src \
  Dockerfile \
  compose.yaml \
  .github/workflows/ci.yml
```

Checklist bắt buộc:
- `ReportEndpoints` không chứa EF/OpenXML logic.
- `German.Application` không reference `German.Infrastructure`.
- Chỉ package mới đã duyệt là `DocumentFormat.OpenXml` 3.5.1.
- Không có secret thật trong Docker/Compose/README.
- `main` không được cập nhật trong task này.

- [ ] **Step 2: Scan credential và working tree**

Run:

```bash
git grep -n "Password=" -- ':!docs/superpowers/**' ':!.env.example' || true
git status --short
```

Expected: không có real database/admin password; working tree clean.

- [ ] **Step 3: Push branch và verify GitHub Actions trên HEAD cuối**

Push:

```bash
git push origin feat/docker-excel-export
```

Expected GitHub Actions jobs: `backend`, `frontend`, `docker` đều `success` trên cùng HEAD SHA.

- [ ] **Step 4: Handoff cho user review**

Báo chính xác:
- branch `feat/docker-excel-export`;
- final HEAD SHA;
- CI status;
- command `docker compose up -d --build`;
- endpoint `/api/reports/production/export.xlsx` và quyền Manager/Admin;
- không merge vào `dev` hoặc `main` cho tới khi user yêu cầu.
