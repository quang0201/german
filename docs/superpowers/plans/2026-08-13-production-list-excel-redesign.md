# Production List UX + Excel Export Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/production` around fast period navigation, full-query summary, date grouping and a two-sheet filtered Excel workbook.

**Architecture:** Production list filtering remains an Application concern. The existing list response gains a summary computed from the same filtered query before pagination; the report service applies equivalent filters and supplies typed metadata/aggregates to the OpenXML exporter. Frontend date/period behavior is isolated in pure helpers and small presentation components, while `ProductionEntryListPage` owns applied query state.

**Tech Stack:** React 19, Bun native tests/build, ASP.NET Core 10 minimal APIs, EF Core, MSTest, DocumentFormat.OpenXml 3.5.1, Docker.

## Global Constraints

- Do not change `ProductionCalculator` or HC/TC business calculations.
- Preserve Worker/Manager/Admin create/edit/delete and export authorization.
- List range remains maximum 31 inclusive days; export remains maximum 366 inclusive days.
- Do not add third-party dependencies.
- Keep ERP tokens: radius 4/6px, controls 38px, table rows 42px, minimal shadows and flat workflow sections.
- Do not convert production rows to cards.
- UI dates use `dd/MM/yyyy`; API dates remain `YYYY-MM-DD`.
- Every task follows RED → GREEN and records exact test commands/results.
- Subagents edit only their assigned file set, do not stage/commit/push, and never revert concurrent/user changes.

---

## File Structure

### Backend/Application

- Create `src/backend/German.Application/ProductionEntries/ProductionEntrySummaryDto.cs`: list summary DTO.
- Create `src/backend/German.Application/ProductionEntries/ProductionEntryListResult.cs`: production-specific paged result with summary.
- Modify `src/backend/German.Application/ProductionEntries/ProductionEntryQueryService.cs`: shared filtered query, aggregate before pagination.
- Modify `src/backend/German.Application/Reports/ProductionReportFilter.cs`: add `Search`.
- Create `src/backend/German.Application/Reports/ProductionReportSummary.cs`: report totals.
- Create `src/backend/German.Application/Reports/ProductionReportDaySummary.cs`: per-day totals.
- Create `src/backend/German.Application/Reports/ProductionReportEmployeeSummary.cs`: per-employee totals.
- Modify `src/backend/German.Application/Reports/ProductionReportData.cs`: metadata, summary and aggregate tables.
- Modify `src/backend/German.Application/Reports/ProductionReportService.cs`: full filter/search and aggregate projection.
- Modify `src/backend/German.Api/Endpoints/ReportEndpoints.cs`: bind/forward search.

### Infrastructure

- Modify `src/backend/German.Infrastructure/Excel/OpenXmlProductionReportExporter.cs`: two worksheets and workbook UX.

### Frontend

- Create `src/frontend/src/features/production-entries/productionPeriod.js`: pure local-date helpers.
- Create `src/frontend/src/features/production-entries/PeriodSelector.jsx`: preset/navigation/custom controls.
- Create `src/frontend/src/features/production-entries/ProductionSummary.jsx`: five summary metrics.
- Create `src/frontend/src/features/production-entries/ProductionEntryGroupedTable.jsx`: semantic grouped rows for multi-day pages.
- Modify `src/frontend/src/features/production-entries/productionEntryQuery.js`: summary normalization and export URL.
- Modify `src/frontend/src/features/production-entries/ProductionEntryListPage.jsx`: state/data flow and page composition.
- Modify `src/frontend/src/styles.css`: period/summary/group responsive styles.

### Tests

- Modify `tests/German.Application.Tests/ProductionEntries/ProductionEntryQueryServiceTests.cs`.
- Modify `tests/German.Application.Tests/Reports/ProductionReportServiceTests.cs`.
- Modify `tests/German.Infrastructure.Tests/Excel/OpenXmlProductionReportExporterTests.cs`.
- Modify `tests/German.Api.Tests/ReportExportApiTests.cs`.
- Create `src/frontend/src/features/production-entries/productionPeriod.test.js`.
- Create `src/frontend/src/features/production-entries/PeriodSelector.test.js`.
- Modify `src/frontend/src/features/production-entries/productionEntryQuery.test.js`.
- Create `src/frontend/src/features/production-entries/ProductionSummary.test.js`.
- Create `src/frontend/src/features/production-entries/ProductionEntryGroupedTable.test.js`.
- Modify `src/frontend/src/app/responsiveStyles.test.js`.

---

### Task 1: Full-query list summary

**Files:**
- Create: `src/backend/German.Application/ProductionEntries/ProductionEntrySummaryDto.cs`
- Create: `src/backend/German.Application/ProductionEntries/ProductionEntryListResult.cs`
- Modify: `src/backend/German.Application/ProductionEntries/ProductionEntryQueryService.cs`
- Modify: `tests/German.Application.Tests/ProductionEntries/ProductionEntryQueryServiceTests.cs`
- Modify if compile requires: `src/backend/German.Api/Endpoints/ProductionEntryEndpoints.cs`

**Interfaces:**
- Produces `ProductionEntrySummaryDto(int EmployeeCount, int EntryCount, decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity)`.
- Produces `ProductionEntryListResult(IReadOnlyList<ProductionEntryListItemDto> Items, int Page, int PageSize, int TotalCount, int TotalPages, ProductionEntrySummaryDto Summary)`.
- `ListAsync` and `ListMineAsync` return `AppResult<ProductionEntryListResult>`.

- [ ] **Step 1: Add failing summary tests**

Add tests that seed at least three matching rows across two employees, request page size 25/page 2 or a filtered subset, and assert summary values cover all matched rows rather than returned items. Add a Worker test asserting `ListMineAsync` summary excludes another employee.

```csharp
Assert.AreEqual(2, result.Value!.Summary.EmployeeCount);
Assert.AreEqual(3, result.Value.Summary.EntryCount);
Assert.AreEqual(30m, result.Value.Summary.HcQuantity);
Assert.AreEqual(6m, result.Value.Summary.TcQuantity);
Assert.AreEqual(36m, result.Value.Summary.TotalQuantity);
```

- [ ] **Step 2: Run RED**

Run:

```powershell
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --filter ProductionEntryQueryServiceTests
```

Expected: compile/test failure because `Summary` and production-specific result do not exist.

- [ ] **Step 3: Implement aggregate before pagination**

Build the joined filtered query once. Apply search before aggregate. Query distinct employees, count and nullable decimal sums before `Skip/Take`; map null sums to zero. Preserve current ordering and validation.

- [ ] **Step 4: Run GREEN and regression**

```powershell
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --filter ProductionEntryQueryServiceTests
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --filter ProductionEntryReadApiTests
```

Expected: all selected tests pass and JSON shape includes camel-cased `summary` through ASP.NET defaults.

---

### Task 2: Filtered report model and aggregates

**Files:**
- Modify: `src/backend/German.Application/Reports/ProductionReportFilter.cs`
- Create: `src/backend/German.Application/Reports/ProductionReportSummary.cs`
- Create: `src/backend/German.Application/Reports/ProductionReportDaySummary.cs`
- Create: `src/backend/German.Application/Reports/ProductionReportEmployeeSummary.cs`
- Modify: `src/backend/German.Application/Reports/ProductionReportData.cs`
- Modify: `src/backend/German.Application/Reports/ProductionReportService.cs`
- Modify: `src/backend/German.Api/Endpoints/ReportEndpoints.cs`
- Modify: `tests/German.Application.Tests/Reports/ProductionReportServiceTests.cs`
- Modify: `tests/German.Api.Tests/ReportExportApiTests.cs`

**Interfaces:**
- `ProductionReportFilter(DateOnly? FromDate, DateOnly? UntilDate, Guid? EmployeeId, Guid? OrderId, Guid? OperationId, string? Search)`.
- `ProductionReportSummary(int EmployeeCount, int EntryCount, decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity)`.
- `ProductionReportDaySummary(DateOnly WorkDate, decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity)`.
- `ProductionReportEmployeeSummary(string EmployeeCode, string EmployeeName, decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity)`.
- `ProductionReportData` exposes dates; Employee/Order/Operation display labels; `FinalMetricLabel`; `Summary`; `ByDay`; `ByEmployee`; `Rows`.

- [ ] **Step 1: Add failing report tests**

Add tests proving search applies to employee code/name, order code/product, operation name and entry-mode matching; metadata resolves selected labels; per-day and per-employee totals match rows; soft-deleted rows remain excluded; final label changes only when `OperationId` is present.

- [ ] **Step 2: Run RED**

```powershell
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --filter ProductionReportServiceTests
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --filter ReportExportApiTests
```

Expected: compile failures for the new filter/data constructor fields or failed search-forwarding assertion.

- [ ] **Step 3: Implement one filtered report projection**

Apply range, IDs and normalized trimmed search before materialization. Project detail rows once; derive summary, day and employee aggregates from the filtered rows. Resolve display labels with `Tất cả` fallbacks. Set final metric label to `Tổng sản lượng` only when `OperationId.HasValue`, otherwise `Tổng lượt công đoạn`.

- [ ] **Step 4: Forward search at API boundary**

Add `string? search` parameter to `ExportProductionAsync` and pass it into `ProductionReportFilter` without changing authorization or file naming.

- [ ] **Step 5: Run GREEN**

```powershell
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --filter ProductionReportServiceTests
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --filter ReportExportApiTests
```

Expected: all selected tests pass, including 366-day boundary and full filter forwarding.

---

### Task 3: Two-sheet OpenXML workbook

**Files:**
- Modify: `src/backend/German.Infrastructure/Excel/OpenXmlProductionReportExporter.cs`
- Modify: `tests/German.Infrastructure.Tests/Excel/OpenXmlProductionReportExporterTests.cs`

**Interfaces:**
- Consumes the Task 2 `ProductionReportData` shape.
- Produces a valid workbook with sheets named exactly `Tổng quan` and `Chi tiết`.

- [ ] **Step 1: Replace old workbook assertions with failing two-sheet assertions**

Assert sheet names/order, overview title/metadata/metric labels/totals, detail headers, frozen row, `AutoFilter` range, `dd/MM/yyyy` number format, numeric quantity cells and valid empty workbook.

```csharp
CollectionAssert.AreEqual(
    new[] { "Tổng quan", "Chi tiết" },
    sheets.Select(sheet => sheet.Name!.Value).ToArray());
```

- [ ] **Step 2: Run RED**

```powershell
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --filter OpenXmlProductionReportExporterTests
```

Expected: old single `Sản lượng` sheet fails the new contract.

- [ ] **Step 3: Implement reusable workbook helpers**

Create separate worksheet builders for overview/detail. Keep cell creation, style creation and column sizing helpers focused. Add styles for title, section/header, date and right-aligned numeric cells. Do not merge any cells in the detail data/filter range.

- [ ] **Step 4: Implement `Tổng quan`**

Write title, date/filter metadata, five metrics, day table with `TỔNG`, employee table with `TỔNG`. Keep all quantity cells numeric.

- [ ] **Step 5: Implement `Chi tiết`**

Write detail headers and rows, freeze row 1, apply AutoFilter through the last row (header-only when empty), date style and numeric styles, then register both sheets in deterministic order.

- [ ] **Step 6: Run GREEN**

```powershell
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --filter OpenXmlProductionReportExporterTests
```

Expected: all exporter tests pass and each generated workbook opens via `SpreadsheetDocument.Open`.

---

### Task 4: Period model and presentation components

**Files:**
- Create: `src/frontend/src/features/production-entries/productionPeriod.js`
- Create: `src/frontend/src/features/production-entries/productionPeriod.test.js`
- Create: `src/frontend/src/features/production-entries/PeriodSelector.jsx`
- Create: `src/frontend/src/features/production-entries/PeriodSelector.test.js`
- Create: `src/frontend/src/features/production-entries/ProductionSummary.jsx`
- Create: `src/frontend/src/features/production-entries/ProductionSummary.test.js`

**Interfaces:**
- `localIsoDate(date = new Date())`.
- `derivePeriodRange({ periodMode, anchorDate, customFromDate, customUntilDate })` returning `{ fromDate, untilDate }`.
- `shiftPeriod(periodMode, anchorDate, direction)` returning ISO local date.
- `formatDisplayDate(isoDate)` and `formatPeriodLabel(state)`.
- `PeriodSelector({ periodMode, anchorDate, customFromDate, customUntilDate, onPreset, onShift, onCustomChange })`.
- `ProductionSummary({ summary, operationSelected })`.

- [ ] **Step 1: Add failing pure helper tests**

Cover local date formatting, yesterday shortcut, Monday–Sunday across month/year boundaries, February leap year, previous/next day/week/month and custom range passthrough.

- [ ] **Step 2: Run helper RED**

```powershell
bun test src/features/production-entries/productionPeriod.test.js
```

Expected: module/functions do not exist.

- [ ] **Step 3: Implement local calendar helpers**

Parse ISO parts into a local `Date(year, month - 1, day, 12)` and format from local getters. Never derive display/navigation by `toISOString()` on a shifted local date.

- [ ] **Step 4: Add failing component tests**

Server-render `PeriodSelector` and assert five buttons, active `aria-pressed`, contextual previous/next labels, custom inputs only in custom mode. Render `ProductionSummary` and assert five values plus dynamic final label.

- [ ] **Step 5: Implement components and run GREEN**

```powershell
bun test src/features/production-entries/productionPeriod.test.js src/features/production-entries/PeriodSelector.test.js src/features/production-entries/ProductionSummary.test.js
```

Expected: all period/component tests pass.

---

### Task 5: Query serialization and grouped production table

**Files:**
- Modify: `src/frontend/src/features/production-entries/productionEntryQuery.js`
- Modify: `src/frontend/src/features/production-entries/productionEntryQuery.test.js`
- Create: `src/frontend/src/features/production-entries/ProductionEntryGroupedTable.jsx`
- Create: `src/frontend/src/features/production-entries/ProductionEntryGroupedTable.test.js`

**Interfaces:**
- `normalizeProductionEntryListResponse` returns summary zeros when absent.
- `buildProductionExportUrl(filters)` serializes from/until/employee/order/operation/search but never page/pageSize.
- `groupProductionEntriesByDate(rows)` returns ordered `{ workDate, rows }[]` preserving backend row order.
- `ProductionEntryGroupedTable` accepts the same row/column/click concerns as the current production `DataTable` use plus `multiDay`.

- [ ] **Step 1: Add failing query tests**

Assert list response summary normalization and exact export URL containing every active filter with trimmed search and no pagination.

- [ ] **Step 2: Add failing grouping tests**

Assert single-day render has no group row; multi-day render displays `dd/MM/yyyy` and `N bản ghi`; row date is visually de-emphasized without removing accessible date content.

- [ ] **Step 3: Run RED**

```powershell
bun test src/features/production-entries/productionEntryQuery.test.js src/features/production-entries/ProductionEntryGroupedTable.test.js
```

Expected: missing export/group interfaces or assertions fail.

- [ ] **Step 4: Implement serialization and grouping**

Reuse `URLSearchParams`. Keep backend ordering; do not resort rows on the client. Use semantic `<tbody>` groups/rows and preserve keyboard/click behavior.

- [ ] **Step 5: Run GREEN**

```powershell
bun test src/features/production-entries/productionEntryQuery.test.js src/features/production-entries/ProductionEntryGroupedTable.test.js
```

Expected: all query/group tests pass.

---

### Task 6: Integrate `/production`, responsive styles and end-to-end verification

**Files:**
- Modify: `src/frontend/src/features/production-entries/ProductionEntryListPage.jsx`
- Modify: `src/frontend/src/styles.css`
- Modify: `src/frontend/src/app/responsiveStyles.test.js`
- Test all Task 4/5 frontend files.

**Interfaces:**
- Consumes Task 1 list `summary`, Task 4 period helpers/components and Task 5 export/group interfaces.
- Produces the final `/production` user journey for all roles.

- [ ] **Step 1: Add failing integration/contract assertions**

Extend frontend tests to assert production page source uses `PeriodSelector`, `ProductionSummary`, `buildProductionExportUrl` and grouped table; responsive CSS must provide 5-column desktop summary, 2–3 columns tablet and 2 columns mobile without changing ERP tokens.

- [ ] **Step 2: Run RED**

```powershell
bun test src/app/responsiveStyles.test.js src/features/production-entries
```

Expected: page/CSS integration assertions fail before the page is rewired.

- [ ] **Step 3: Rewire applied state**

Initialize `day/today`. Preset or arrow changes update period and immediately apply dates with page 1. Custom inputs remain draft until valid and submitted. Secondary business filters apply together and reset page. Worker receives period/summary but not business lookup/filter/export controls.

- [ ] **Step 4: Rewire summary, export and grouping**

Render order: PageHeader, PeriodSelector, ProductionSummary, secondary FilterBar, grouped/single-day table, Pagination. Export uses applied filters and mode-specific label: `Xuất ngày`, `Xuất tuần`, `Xuất tháng`, `Xuất Excel`.

- [ ] **Step 5: Add responsive CSS**

Use flat bordered sections and existing tokens. Period buttons wrap; summary uses five columns desktop, three/two compact/tablet and two mobile. Keep production table horizontal overflow and existing mobile priority columns.

- [ ] **Step 6: Run all automated verification**

```powershell
bun test
bun run build
dotnet build German.sln --configuration Release
dotnet test German.sln --configuration Release --no-build
docker build -t german-production-redesign:verify .
```

Expected: every command exits 0.

- [ ] **Step 7: Browser/Docker QA**

Run the verified image against the existing local preview database. Authenticate as `quang`; inspect desktop 1440, compact 1100, tablet 768 and mobile 375. Validate every preset and arrow, custom-only fields, summary/filter alignment, multi-day group headers, single-day absence, pagination reset, export request query, no shell overflow and no console errors. Do not create/delete production data during QA.

- [ ] **Step 8: Final code review and PR preparation**

Main agent reviews the entire diff against the design spec, resolves findings through the responsible subagent, confirms only intended files changed, then stages explicit paths. Before external writes, obtain/confirm commit and push authorization. Create one Draft PR from `feat/production-list-excel-redesign` to `dev`, do not merge, and wait for CI completion.
