# Docker + Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung export báo cáo sản lượng `.xlsx` cho Manager/Admin và đóng gói toàn bộ React + ASP.NET Core Minimal API vào một Docker container kết nối PostgreSQL remote qua `.env`.

**Architecture:** Giữ nguyên layered modular monolith. `German.Application` sở hữu query/report model và abstraction exporter; `German.Infrastructure` triển khai OpenXML; `German.Api` chỉ map Minimal API + authorization + file response. Docker build React bằng Bun, publish ASP.NET Core bằng .NET SDK, rồi chạy trên ASP.NET Core runtime image; Compose không chạy PostgreSQL local.

**Tech Stack:** .NET 10, ASP.NET Core Minimal API, EF Core 10.0.10, PostgreSQL/Npgsql, React 19.2.7, Bun 1.3.14, Tailwind CSS 4.3.0, `DocumentFormat.OpenXml` 3.5.1, Docker/Compose.

## Global Constraints

- Giữ dependency direction: `Domain <- Application <- Infrastructure`, và `Api -> Application + Infrastructure` chỉ cho composition root.
- `German.Api/Endpoints` không được query EF/DbContext trực tiếp.
- Backend tiếp tục dùng ASP.NET Core Minimal API; không thêm MVC Controllers.
- Excel implementation chỉ nằm trong `German.Infrastructure`.
- Chỉ `Manager` và `Admin` được export; Worker = 403, anonymous = 401.
- Export date range tối đa 366 ngày; không truyền ngày thì mặc định ngày hiện tại.
- Soft-deleted `ProductionEntry` không được xuất.
- PostgreSQL là remote; Compose không tạo database container.
- `.env` không commit; chỉ commit `.env.example`.
- Runtime container expose port `8080` và healthcheck `/health`.
- Không thêm ClosedXML, EPPlus, NPOI hoặc package Excel khác.
- Thực hiện TDD: test đỏ trước, implementation tối thiểu sau, chạy test xanh rồi commit.

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

`.gitignore` đã có `.env`, `.env.*`, `!.env.example`; chỉ sửa nếu verification phát hiện rule bị mất.

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
- Consumes: `IGermanDbContext`, `TimeProvider`, existing `ProductionEntry`, `Employee`, `ProductionOrder`, `ProductionOperation`.
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
```

`ProductionReportService` signature:

```csharp
public sealed class ProductionReportService(IGermanDbContext db, TimeProvider timeProvider)
{
    public Task<AppResult<ProductionReportData>> BuildAsync(
        ProductionReportFilter filter,
        CancellationToken cancellationToken);
}
```

- [ ] **Step 1: Viết test đỏ cho default date và mapping dữ liệu**

Trong `ProductionReportServiceTests.cs`, dùng EF Core InMemory giống các Application tests hiện tại, seed `Employee`, `ProductionOrder`, `ProductionOperation`, `ProductionEntry`, và dùng `FakeTimeProvider` nội bộ test thay vì package ngoài:

```csharp
private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => utcNow;
}
```

Test chính:

```csharp
[TestMethod]
public async Task BuildAsync_DefaultsToCurrentDateAndMapsRows()
{
    var today = new DateOnly(2026, 8, 12);
    var service = CreateService(new DateTimeOffset(2026, 8, 12, 3, 0, 0, TimeSpan.Zero));

    var result = await service.BuildAsync(
        new ProductionReportFilter(null, null, null, null, null),
        CancellationToken.None);

    Assert.IsTrue(result.IsSuccess);
    Assert.AreEqual(today, result.Value!.FromDate);
    Assert.AreEqual(today, result.Value.UntilDate);
    Assert.AreEqual(1, result.Value.Rows.Count);
    Assert.AreEqual("E001", result.Value.Rows[0].EmployeeCode);
    Assert.AreEqual(100m, result.Value.Rows[0].HcQuantity);
    Assert.AreEqual(20m, result.Value.Rows[0].TcQuantity);
    Assert.AreEqual(120m, result.Value.Rows[0].TotalQuantity);
}
```

- [ ] **Step 2: Viết test đỏ cho validation range và soft delete/filter**

Thêm các test có tên cụ thể:

```csharp
[TestMethod]
public async Task BuildAsync_RejectsReversedDateRange() { /* assert code reports.invalid_date_range */ }

[TestMethod]
public async Task BuildAsync_RejectsRangeLongerThan366Days() { /* assert code reports.date_range_too_large */ }

[TestMethod]
public async Task BuildAsync_ExcludesSoftDeletedEntries() { /* IsDeleted=true không xuất */ }

[TestMethod]
public async Task BuildAsync_AppliesEmployeeOrderAndOperationFilters() { /* chỉ còn row khớp cả 3 */ }
```

Ngày range hợp lệ tính inclusive; reject khi:

```csharp
(untilDate.DayNumber - fromDate.DayNumber) > 365
```

- [ ] **Step 3: Chạy test để xác nhận RED**

Run:

```bash
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj \
  --configuration Release \
  --filter FullyQualifiedName~ProductionReportServiceTests
```

Expected: FAIL do namespace/types `German.Application.Reports` chưa tồn tại.

- [ ] **Step 4: Implement model + service tối thiểu**

`BuildAsync` phải resolve ngày như sau:

```csharp
var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
var fromDate = filter.FromDate ?? filter.UntilDate ?? today;
var untilDate = filter.UntilDate ?? filter.FromDate ?? today;
```

Validation:

```csharp
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
```

Query phải bắt đầu từ:

```csharp
var query = db.ProductionEntries.AsNoTracking()
    .Where(x => !x.IsDeleted && x.WorkDate >= fromDate && x.WorkDate <= untilDate);
```

Áp dụng từng optional filter trước khi join/project. Projection lấy tên/mã từ các bảng liên quan và sort ổn định theo `WorkDate`, `EmployeeCode`, `ProductionOrderCode`, `OperationNumber`.

- [ ] **Step 5: Chạy test và toàn Application suite**

Run:

```bash
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --configuration Release
```

Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

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
- Consumes: `IProductionReportExporter`, `ProductionReportData`, `ProductionReportRow` từ Task 1.
- Produces: `OpenXmlProductionReportExporter : IProductionReportExporter`.

- [ ] **Step 1: Thêm test project trước implementation**

Tạo `tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj`:

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

Add project vào solution bằng CLI:

```bash
dotnet sln German.sln add tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj
```

- [ ] **Step 2: Viết OpenXML tests trước khi thêm exporter**

Tests bắt buộc:

```csharp
[TestMethod]
public void Export_CreatesWorkbookWithProductionSheetAndHeaders() { }

[TestMethod]
public void Export_WritesQuantitiesAsNumericCells() { }

[TestMethod]
public void Export_EmptyRowsStillCreatesValidWorkbook() { }
```

Mỗi test parse bytes bằng:

```csharp
using var stream = new MemoryStream(bytes);
using var document = SpreadsheetDocument.Open(stream, false);
```

Header expected đúng thứ tự:

```csharp
var expectedHeaders = new[]
{
    "Ngày", "Mã NV", "Họ tên", "Mã SX", "Sản phẩm", "CĐ", "Tên công đoạn",
    "Đơn vị", "HC", "TC", "Tổng", "Giờ TC", "Kiểu nhập", "Ghi chú"
};
```

Numeric cells `HC`, `TC`, `Tổng`, `Giờ TC` phải có `DataType == null` hoặc numeric-compatible, không phải `CellValues.String`/`InlineString`.

- [ ] **Step 3: Chạy test để xác nhận RED**

Run:

```bash
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --configuration Release
```

Expected: FAIL vì `OpenXmlProductionReportExporter` chưa tồn tại và package chưa được reference.

- [ ] **Step 4: Thêm dependency OpenXML 3.5.1**

Trong `German.Infrastructure.csproj` thêm:

```xml
<PackageReference Include="DocumentFormat.OpenXml" Version="3.5.1" />
```

Không thêm package Excel khác.

- [ ] **Step 5: Implement `OpenXmlProductionReportExporter`**

Exporter dùng `MemoryStream` + `SpreadsheetDocument.Create`:

```csharp
public byte[] Export(ProductionReportData report)
{
    using var stream = new MemoryStream();
    using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook))
    {
        // WorkbookPart, WorksheetPart, Stylesheet, SheetData, Sheet("Sản lượng")
        // header row + data rows + freeze pane + auto filter + column widths
    }

    return stream.ToArray();
}
```

Formatting bắt buộc:
- Sheet name: `Sản lượng`.
- Header bold.
- Freeze row 1 bằng `Pane { VerticalSplit = 1D, TopLeftCell = "A2", ActivePane = PaneValues.BottomLeft, State = PaneStateValues.Frozen }`.
- `AutoFilter` range từ `A1:N{lastRow}`; với empty data dùng `A1:N1`.
- Ngày cell lưu numeric OA date + style `dd/MM/yyyy`, không ghi ngày thành string.
- Quantity/overtime dùng invariant culture numeric text.
- Text cell dùng `InlineString` để không cần shared string table.
- Set width cố định hợp lý cho 14 columns, không cố giả lập true auto-fit.

- [ ] **Step 6: Đăng ký DI**

Trong `DependencyInjection.cs` thêm:

```csharp
services.AddSingleton<IProductionReportExporter, OpenXmlProductionReportExporter>();
```

Thêm using cho `German.Application.Reports` và `German.Infrastructure.Excel`.

- [ ] **Step 7: Chạy Infrastructure tests + full backend build**

Run:

```bash
dotnet restore German.sln
dotnet build German.sln --no-restore --configuration Release
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-build --configuration Release
```

Expected: build 0 errors và tests PASS.

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
- Consumes: `ProductionReportService.BuildAsync(...)`, `IProductionReportExporter.Export(...)`, existing `ManagerOrAdmin` policy.
- Produces: `GET /api/reports/production/export.xlsx`.

- [ ] **Step 1: Viết API integration tests trước endpoint**

Tests bắt buộc:

```csharp
[TestMethod]
public async Task Export_Anonymous_ReturnsUnauthorized() { }

[TestMethod]
public async Task Export_Worker_ReturnsForbidden() { }

[TestMethod]
public async Task Export_Manager_ReturnsXlsx() { }

[TestMethod]
public async Task Export_Admin_ReturnsXlsx() { }

[TestMethod]
public async Task Export_InvalidDateRange_ReturnsBadRequest() { }
```

Manager/Admin success assertions:

```csharp
Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
Assert.AreEqual(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    response.Content.Headers.ContentType!.MediaType);
Assert.IsTrue((await response.Content.ReadAsByteArrayAsync()).Length > 0);
```

Worker login bằng cookie thật giống test suite hiện có; không bypass authorization middleware.

- [ ] **Step 2: Chạy API tests để xác nhận RED**

Run:

```bash
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj \
  --configuration Release \
  --filter FullyQualifiedName~ReportExportApiTests
```

Expected: 404 cho endpoint chưa tồn tại (sau login), test success fail.

- [ ] **Step 3: Implement Minimal API endpoint**

`ReportEndpoints.cs`:

```csharp
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
}
```

Handler signature:

```csharp
private static async Task<IResult> ExportProductionAsync(
    DateOnly? fromDate,
    DateOnly? untilDate,
    Guid? employeeId,
    Guid? orderId,
    Guid? operationId,
    ProductionReportService service,
    IProductionReportExporter exporter,
    CancellationToken cancellationToken)
```

Flow:

```csharp
var result = await service.BuildAsync(
    new ProductionReportFilter(fromDate, untilDate, employeeId, orderId, operationId),
    cancellationToken);

if (!result.IsSuccess)
{
    return ApiResultMapper.Error(result.Error!);
}

var report = result.Value!;
var bytes = exporter.Export(report);
var fileName = $"san-luong_{report.FromDate:yyyyMMdd}_{report.UntilDate:yyyyMMdd}.xlsx";
return Results.File(bytes, XlsxContentType, fileName);
```

- [ ] **Step 4: Đăng ký service/map endpoint trong Program**

Thêm:

```csharp
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ProductionReportService>();
```

Và trước fallback:

```csharp
app.MapReportEndpoints();
```

Không đưa OpenXML type vào `Program.cs`; chỉ interface được resolve qua DI.

- [ ] **Step 5: Chạy API suite và full backend tests**

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
- Consumes: source tree.
- Produces: CI guardrail ngăn OpenXML/persistence leak lên API endpoints/Application.

- [ ] **Step 1: Viết test guardrail đỏ**

Bổ sung test:

```javascript
test("report export keeps OpenXML in Infrastructure", () => {
  const applicationReports = csFiles("src/backend/German.Application/Reports");
  const apiEndpoints = csFiles("src/backend/German.Api/Endpoints");
  const forbidden = "DocumentFormat.OpenXml";

  const violations = [...applicationReports, ...apiEndpoints]
    .filter((path) => read(path).includes(forbidden));

  expect(violations).toEqual([]);
});
```

Mở rộng endpoint persistence guardrail hiện có để vẫn cấm `IGermanDbContext`, `DbContext`, `Microsoft.EntityFrameworkCore` trong endpoint mới.

- [ ] **Step 2: Chạy architecture tests**

Run:

```bash
cd src/frontend
bun test src/architecture.test.js
```

Expected: PASS nếu Tasks 1-3 giữ đúng boundary. Nếu fail, sửa production code, không nới test để bỏ qua violation.

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
- Consumes: existing frontend `bun run build`, backend `German.Api` publish, `ConnectionStrings__German` and bootstrap environment variables.
- Produces: one `german-app` image/service at port 8080.

- [ ] **Step 1: Generate và commit Bun lockfile**

Repo hiện chưa có Bun lockfile. Tại `src/frontend` chạy:

```bash
bun install
bun install --frozen-lockfile
```

Expected: lệnh thứ hai PASS và tạo/đọc `src/frontend/bun.lock` ổn định.

Không đổi version dependencies ngoài những gì `package.json` đã pin.

- [ ] **Step 2: Viết Dockerfile multi-stage**

Tạo root `Dockerfile`:

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

- [ ] **Step 3: Thêm `.dockerignore`**

Nội dung tối thiểu:

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

Không ignore source/migrations cần cho publish.

- [ ] **Step 4: Thêm `.env.example`**

```text
APP_PORT=8080
ConnectionStrings__German=Host=db.example.com;Port=5432;Database=german;Username=german;Password=change-me;SSL Mode=Require
BootstrapAdmin__Enabled=false
BootstrapAdmin__Username=admin
BootstrapAdmin__Password=change-me
```

`.gitignore` đã phải giữ `.env` và chỉ allow `.env.example`.

- [ ] **Step 5: Thêm `compose.yaml`**

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

Không thêm PostgreSQL service, volume hoặc local database credential.

- [ ] **Step 6: Verify Docker build/config**

Run:

```bash
cp .env.example .env
docker build -t german:local .
docker compose config >/dev/null
rm .env
```

Expected: image build PASS, Compose config PASS, `.env` không xuất hiện trong `git status`.

Nếu có PostgreSQL remote test credential trong môi trường local/CI, smoke test thêm:

```bash
docker compose up -d --build
curl --fail http://localhost:${APP_PORT:-8080}/health
docker compose down
```

Không dùng credential thật trong repo/CI logs.

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
- Consumes: Dockerfile/compose from Task 5, all test projects from prior tasks.
- Produces: CI gate và operator instructions.

- [ ] **Step 1: Cập nhật backend CI cho Infrastructure tests**

Sau Application tests, thêm:

```yaml
      - name: Test infrastructure
        run: dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-build --configuration Release
```

Giữ Domain/Application/API tests hiện có.

- [ ] **Step 2: Thêm Docker CI job**

Trong `.github/workflows/ci.yml` thêm job độc lập:

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

Không chạy container trong CI vì startup sẽ yêu cầu PostgreSQL remote thật và migration; build/config là gate không cần secret.

- [ ] **Step 3: Cập nhật README phần Docker**

Documentation phải chứa đúng flow:

```bash
cp .env.example .env
# chỉnh ConnectionStrings__German và BootstrapAdmin nếu cần
docker compose up -d --build
docker compose logs -f german-app
docker compose down
```

Nêu rõ:
- PostgreSQL phải là remote và cho phép host Docker kết nối.
- Không commit `.env`.
- App tự chạy EF migration lúc startup.
- `APP_PORT` mặc định 8080.

- [ ] **Step 4: Cập nhật README phần Excel**

Ghi endpoint:

```text
GET /api/reports/production/export.xlsx
```

Query:

```text
fromDate, untilDate, employeeId, orderId, operationId
```

Quyền: `Manager/Admin`; max 366 ngày; không truyền ngày = hôm nay.

- [ ] **Step 5: Run full verification trước commit**

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
- .NET build: 0 errors.
- All backend tests: PASS.
- Bun tests including architecture guardrails: PASS.
- Frontend production build: PASS.
- Compose config: PASS.
- Docker image build: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: verify Docker and Excel export"
```

---

### Task 7: Final branch verification và review handoff

**Files:**
- No production file changes unless verification exposes a defect.

**Interfaces:**
- Consumes: toàn feature branch.
- Produces: branch sẵn sàng merge vào `dev`, không merge `main`.

- [ ] **Step 1: Check architecture diff**

Run:

```bash
git diff dev...HEAD -- src/backend src/frontend/src Dockerfile compose.yaml .github/workflows/ci.yml
```

Review specifically:
- no EF/OpenXML query logic in Minimal API endpoint;
- no Application -> Infrastructure project reference;
- only approved new package is `DocumentFormat.OpenXml`;
- no secrets in Docker/Compose/README.

- [ ] **Step 2: Scan secrets/config**

Run:

```bash
git grep -nE 'Password=[^c]|BootstrapAdmin__Password=.+' -- ':!docs/superpowers/**' ':!.env.example' || true
git status --short
```

Expected: không có real credential; working tree clean.

- [ ] **Step 3: Verify GitHub Actions on final HEAD**

Push feature branch and wait for `backend`, `frontend`, `docker` jobs to complete successfully.

Expected: all required jobs = success.

- [ ] **Step 4: Handoff**

Báo cho user:
- branch `feat/docker-excel-export` ready;
- commit HEAD;
- CI results;
- exact Docker run command;
- Excel endpoint/authorization;
- không merge vào `dev` cho tới khi user yêu cầu review/merge.
