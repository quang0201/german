# Excel Management Sunday Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production Excel management report match the approved horizontal layout, add Vietnamese weekday labels, and let managers exclude Sundays from the entire workbook through a frontend option that defaults to enabled.

**Architecture:** The frontend owns the user choice and serializes `excludeSundays` only for export requests. `German.Application` owns report filtering semantics and removes Sunday rows before report aggregates are calculated; `German.Infrastructure` only renders the already-filtered report and uses the report metadata to build the horizontal date axis. `German.Api` remains a thin optional-query-parameter adapter, with omitted `excludeSundays` preserving the existing include-Sunday behavior for direct API callers.

**Tech Stack:** React 19, Bun 1.3.14 native tests/build, ASP.NET Core 10 Minimal APIs, EF Core, MSTest, DocumentFormat.OpenXml 3.5.1, Docker.

## Global Constraints

- Target branch is `dev`; implementation branch is `fix/excel-sunday-layout`.
- Do not change `ProductionCalculator` or HC/TC business calculations.
- Preserve Manager/Admin-only export authorization.
- Preserve soft-delete semantics and all existing employee/order/operation/search filters.
- Export range remains maximum 366 inclusive calendar days, even when Sundays are excluded.
- Do not add third-party dependencies or database migrations.
- `Báo cáo quản lý` remains the first and active workbook sheet, followed by `Tổng quan` and `Chi tiết`.
- Management layout remains `Nhân viên | CĐ | ĐVT | [ngày HC/TC...] | Tổng HC | Tổng TC | Tổng`.
- `CĐ` remains compact (`CĐ12`), without the operation name in `Báo cáo quản lý`.
- Remove `TỔNG THEO CÔNG ĐOẠN` completely; do not replace it with another subtotal or grand-total section.
- Header weekday labels are exactly `T2`, `T3`, `T4`, `T5`, `T6`, `T7`, `CN` followed by `dd/MM/yyyy`.
- Frontend option label is exactly `Bỏ Chủ nhật`, checked by default whenever the export dialog opens.
- If `Bỏ Chủ nhật` is checked, Sunday entries must be absent from every workbook sheet and every exported aggregate.
- If `Bỏ Chủ nhật` is unchecked, Sunday entries are included normally and management headers show `CN`.
- HTTP callers that omit `excludeSundays` must continue to include Sundays.
- Every implementation task follows RED → GREEN and ends with a focused commit.

---

## File Structure

### Frontend export option

- Modify `src/frontend/src/features/production-entries/productionExport.js`: own pure export-draft/payload state so default/reset behavior can be unit-tested without adding a DOM testing dependency.
- Modify `src/frontend/src/features/production-entries/ProductionExportDialog.jsx`: render the `Bỏ Chủ nhật` checkbox, reset it to checked on open, and return the boolean in the export payload.
- Modify `src/frontend/src/features/production-entries/productionEntryQuery.js`: serialize `excludeSundays` only for the report export URL, never for the production list URL.
- Modify `src/frontend/src/styles.css`: add minimal layout styling for the export checkbox using existing ERP tokens.
- Modify `src/frontend/src/features/production-entries/productionExport.test.js`.
- Modify `src/frontend/src/features/production-entries/ProductionExportDialog.test.js`.
- Modify `src/frontend/src/features/production-entries/productionEntryQuery.test.js`.

### Application report semantics

- Modify `src/backend/German.Application/Reports/ProductionReportFilter.cs`: append `bool ExcludeSundays = false` for backward-compatible construction.
- Modify `src/backend/German.Application/Reports/ProductionReportData.cs`: expose `bool ExcludeSundays` as presentation metadata for the exporter.
- Modify `src/backend/German.Application/Reports/ProductionReportService.cs`: remove Sunday entries from the query result set before materialization/aggregation when requested.
- Modify `tests/German.Application.Tests/Reports/ProductionReportServiceTests.cs`.

### API boundary

- Modify `src/backend/German.Api/Endpoints/ReportEndpoints.cs`: bind optional `bool? excludeSundays` and pass `excludeSundays ?? false` into `ProductionReportFilter`.
- Modify `tests/German.Api.Tests/ReportExportApiTests.cs`: prove true excludes Sunday from the generated workbook and omission preserves Sunday.

### OpenXML management report

- Modify `src/backend/German.Infrastructure/Excel/OpenXmlProductionReportExporter.cs`: remove operation subtotal rendering, add weekday labels, and omit Sunday date columns when report metadata says Sundays were excluded.
- Modify `tests/German.Infrastructure.Tests/Excel/OpenXmlProductionReportExporterTests.cs`.

### Documentation and verification

- Modify `docs/testing/production-management-report.tdd.md`: append RED/GREEN evidence for this follow-up contract fix after commands have actually run.

---

### Task 1: Frontend export option and request serialization

**Files:**
- Modify: `src/frontend/src/features/production-entries/productionExport.js`
- Modify: `src/frontend/src/features/production-entries/ProductionExportDialog.jsx`
- Modify: `src/frontend/src/features/production-entries/productionEntryQuery.js`
- Modify: `src/frontend/src/styles.css`
- Test: `src/frontend/src/features/production-entries/productionExport.test.js`
- Test: `src/frontend/src/features/production-entries/ProductionExportDialog.test.js`
- Test: `src/frontend/src/features/production-entries/productionEntryQuery.test.js`

**Interfaces:**
- Produces `createProductionExportDraft({ initialMode, initialAnchorDate, initialFromDate, initialUntilDate })` returning `{ periodMode, anchorDate, fromDate, untilDate, excludeSundays: true }`.
- Produces `createProductionExportPayload(draft)` returning `{ fromDate, untilDate, excludeSundays }`.
- `ProductionExportDialog.onExport` receives `{ fromDate: string, untilDate: string, excludeSundays: boolean }`.
- `buildProductionExportUrl(filters)` serializes `excludeSundays=true|false` when the caller supplies a boolean; `buildProductionEntryListQuery` never serializes it.

- [ ] **Step 1: Write failing pure-state tests for the default and unchecked payload**

In `productionExport.test.js`, add imports for the new helpers and tests with exact expectations:

```js
import {
  createProductionExportDraft,
  createProductionExportPayload,
  exportRangeError,
  listRangeError,
} from "./productionExport.js";

test("creates every export draft with Sunday exclusion enabled", () => {
  expect(createProductionExportDraft({
    initialMode: "custom",
    initialAnchorDate: "2026-08-17",
    initialFromDate: "2026-08-10",
    initialUntilDate: "2026-08-17",
  })).toEqual({
    periodMode: "custom",
    anchorDate: "2026-08-17",
    fromDate: "2026-08-10",
    untilDate: "2026-08-17",
    excludeSundays: true,
  });
});

test("builds an export payload with the current Sunday choice", () => {
  expect(createProductionExportPayload({
    fromDate: "2026-08-10",
    untilDate: "2026-08-17",
    excludeSundays: false,
  })).toEqual({
    fromDate: "2026-08-10",
    untilDate: "2026-08-17",
    excludeSundays: false,
  });
});
```

The first helper is also the reset mechanism: every `open` transition calls it again, therefore reopening the dialog deterministically restores `excludeSundays: true`.

- [ ] **Step 2: Write failing URL serialization tests**

In `productionEntryQuery.test.js`, update the export URL assertion to pass `excludeSundays: true` and expect the final query parameter:

```js
expect(buildProductionExportUrl({
  fromDate: "2026-08-01",
  untilDate: "2026-08-12",
  employeeId: "employee-1",
  orderId: "order-1",
  operationId: "operation-1",
  search: "  E001 & CĐ2  ",
  excludeSundays: true,
  page: 2,
  pageSize: 100,
})).toBe("/api/reports/production/export.xlsx?fromDate=2026-08-01&untilDate=2026-08-12&employeeId=employee-1&orderId=order-1&operationId=operation-1&search=E001+%26+C%C4%902&excludeSundays=true");
```

Add an explicit false case and a list-query guard:

```js
expect(buildProductionExportUrl({
  fromDate: "2026-08-01",
  untilDate: "2026-08-12",
  excludeSundays: false,
})).toContain("excludeSundays=false");

expect(buildProductionEntryListQuery({
  fromDate: "2026-08-01",
  untilDate: "2026-08-12",
  excludeSundays: true,
})).not.toContain("excludeSundays");
```

- [ ] **Step 3: Write the failing dialog markup assertion**

In `ProductionExportDialog.test.js`, extend the open-dialog test:

```js
expect(html).toContain("Bỏ Chủ nhật");
expect(html).toContain('type="checkbox"');
expect(html).toMatch(/type="checkbox"[^>]*checked/);
```

- [ ] **Step 4: Run frontend RED**

Run from `src/frontend`:

```bash
bun test src/features/production-entries/productionExport.test.js src/features/production-entries/productionEntryQuery.test.js src/features/production-entries/ProductionExportDialog.test.js
```

Expected: FAIL because export draft/payload helpers, checkbox markup, and `excludeSundays` serialization do not exist yet.

- [ ] **Step 5: Implement pure export draft/payload helpers**

In `productionExport.js`, keep existing range validation and add:

```js
export function createProductionExportDraft({
  initialMode,
  initialAnchorDate,
  initialFromDate,
  initialUntilDate,
}) {
  const periodMode = initialMode || "day";
  const range = periodMode === "custom"
    ? { fromDate: initialFromDate, untilDate: initialUntilDate }
    : deriveExportRange({
        periodMode,
        anchorDate: initialAnchorDate,
        customFromDate: initialFromDate,
        customUntilDate: initialUntilDate,
      });

  return {
    periodMode,
    anchorDate: initialAnchorDate,
    ...range,
    excludeSundays: true,
  };
}

export function createProductionExportPayload(draft) {
  return {
    fromDate: draft.fromDate,
    untilDate: draft.untilDate,
    excludeSundays: Boolean(draft.excludeSundays),
  };
}
```

- [ ] **Step 6: Wire the dialog checkbox and reset behavior**

In `ProductionExportDialog.jsx`:

1. Replace the local `initialDraft` helper with the imported `createProductionExportDraft`.
2. Keep the existing `useEffect`, but call `createProductionExportDraft(...)` whenever `open` is true so reopening resets the checkbox.
3. Add a controlled checkbox below the visible range:

```jsx
<label className="erp-export-option">
  <input
    type="checkbox"
    checked={draft.excludeSundays}
    onChange={(event) => setDraft((current) => ({
      ...current,
      excludeSundays: event.target.checked,
    }))}
  />
  <span>Bỏ Chủ nhật</span>
</label>
```

4. Submit the pure payload:

```js
function submit() {
  if (!rangeError) onExport?.(createProductionExportPayload(draft));
}
```

Preserve preset/date selection behavior so changing the date range does not reset the checkbox during one open dialog session.

- [ ] **Step 7: Serialize the boolean only on export URLs**

In `productionEntryQuery.js`, leave `addProductionEntryFilters` unchanged and append the export-only parameter inside `buildProductionExportUrl`:

```js
export function buildProductionExportUrl(filters = {}) {
  const params = new URLSearchParams();
  addProductionEntryFilters(params, filters);
  if (typeof filters.excludeSundays === "boolean") {
    params.set("excludeSundays", String(filters.excludeSundays));
  }
  return `${filters.basePath || "/api/reports/production/export.xlsx"}?${params.toString()}`;
}
```

This ensures the production list API contract is unchanged.

- [ ] **Step 8: Add minimal checkbox styling**

In `styles.css`, next to the existing export-dialog rules add:

```css
.erp-export-option { display: flex; align-items: center; gap: 8px; margin-top: 14px; color: var(--color-text); font-weight: 700; }
.erp-export-option input { width: 16px; height: 16px; margin: 0; accent-color: var(--color-primary); }
```

Do not introduce new colors, radii, or component dependencies.

- [ ] **Step 9: Run frontend GREEN**

Run:

```bash
bun test src/features/production-entries/productionExport.test.js src/features/production-entries/productionEntryQuery.test.js src/features/production-entries/ProductionExportDialog.test.js
```

Expected: all selected frontend tests PASS.

- [ ] **Step 10: Commit frontend behavior**

```bash
git add src/frontend/src/features/production-entries/productionExport.js \
  src/frontend/src/features/production-entries/productionExport.test.js \
  src/frontend/src/features/production-entries/ProductionExportDialog.jsx \
  src/frontend/src/features/production-entries/ProductionExportDialog.test.js \
  src/frontend/src/features/production-entries/productionEntryQuery.js \
  src/frontend/src/features/production-entries/productionEntryQuery.test.js \
  src/frontend/src/styles.css
git commit -m "feat: add Sunday exclusion export option"
```

---

### Task 2: Application-level Sunday exclusion semantics

**Files:**
- Modify: `src/backend/German.Application/Reports/ProductionReportFilter.cs`
- Modify: `src/backend/German.Application/Reports/ProductionReportData.cs`
- Modify: `src/backend/German.Application/Reports/ProductionReportService.cs`
- Test: `tests/German.Application.Tests/Reports/ProductionReportServiceTests.cs`

**Interfaces:**
- `ProductionReportFilter(..., string? Search, bool ExcludeSundays = false)`.
- `ProductionReportData.ExcludeSundays` is a `bool` init property, default `false`.
- When `ExcludeSundays == true`, `Rows`, `Summary`, `ByDay`, and `ByEmployee` all exclude Sunday production.

- [ ] **Step 1: Write failing Application tests**

Use Sunday `2026-08-16` and Monday `2026-08-17`. Seed one Sunday entry and one Monday entry for the same employee/order/operation, using different HC/TC values so the totals prove filtering.

Add a test equivalent to:

```csharp
[TestMethod]
public async Task BuildAsync_ExcludeSundays_RemovesSundayFromRowsAndAllAggregates()
{
    await using var db = CreateDb();
    var seed = await SeedAsync(db, new DateOnly(2026, 8, 16));
    await AddEntryAsync(
        db,
        seed.Employee,
        seed.Order,
        seed.Operation,
        new DateOnly(2026, 8, 17),
        30m,
        5m);

    var service = new ProductionReportService(db, TimeProvider.System);
    var result = await service.BuildAsync(
        new ProductionReportFilter(
            new DateOnly(2026, 8, 16),
            new DateOnly(2026, 8, 17),
            null,
            null,
            null,
            null,
            true),
        CancellationToken.None);

    Assert.IsTrue(result.IsSuccess);
    Assert.IsTrue(result.Value!.ExcludeSundays);
    Assert.AreEqual(1, result.Value.Rows.Count);
    Assert.AreEqual(new DateOnly(2026, 8, 17), result.Value.Rows.Single().WorkDate);
    Assert.AreEqual(new ProductionReportSummary(1, 1, 30m, 5m, 35m), result.Value.Summary);
    CollectionAssert.AreEqual(
        new[] { new ProductionReportDaySummary(new DateOnly(2026, 8, 17), 30m, 5m, 35m) },
        result.Value.ByDay.ToArray());
    CollectionAssert.AreEqual(
        new[] { new ProductionReportEmployeeSummary("E001", "Nguyễn Văn A", 30m, 5m, 35m) },
        result.Value.ByEmployee.ToArray());
}
```

Add a compatibility test using the existing six-argument constructor or explicit `false` and assert both dates remain in `Rows` and the Sunday quantity remains in `Summary`.

- [ ] **Step 2: Run Application RED**

Run:

```bash
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --filter ProductionReportServiceTests --no-restore
```

Expected: compile/test failure because `ExcludeSundays` is not part of the report contract and Sunday rows are not filtered.

- [ ] **Step 3: Extend report filter/data contracts**

Change `ProductionReportFilter.cs` to:

```csharp
public sealed record ProductionReportFilter(
    DateOnly? FromDate,
    DateOnly? UntilDate,
    Guid? EmployeeId,
    Guid? OrderId,
    Guid? OperationId,
    string? Search,
    bool ExcludeSundays = false);
```

In `ProductionReportData.cs`, add:

```csharp
public bool ExcludeSundays { get; init; }
```

Default remains false, so existing direct construction in exporter tests stays backward compatible until specific Sunday cases opt in.

- [ ] **Step 4: Filter Sundays before report rows are materialized**

Do not rely on provider translation of `DateOnly.DayOfWeek`. The export range is at most 366 days, so build a small deterministic list of actual Sunday `DateOnly` values and let EF translate `Contains` to an `IN` predicate.

Add a private helper:

```csharp
private static DateOnly[] GetSundays(DateOnly fromDate, DateOnly untilDate)
{
    var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)fromDate.DayOfWeek + 7) % 7;
    var firstSunday = fromDate.AddDays(daysUntilSunday);
    if (firstSunday > untilDate)
    {
        return [];
    }

    var result = new List<DateOnly>();
    for (var date = firstSunday; date <= untilDate; date = date.AddDays(7))
    {
        result.Add(date);
    }

    return result.ToArray();
}
```

After base ID/range predicates and before search/materialization:

```csharp
if (filter.ExcludeSundays)
{
    var sundays = GetSundays(fromDate, untilDate);
    if (sundays.Length > 0)
    {
        query = query.Where(item => !sundays.Contains(item.entry.WorkDate));
    }
}
```

This keeps Sunday data out before `Rows`, `Summary`, `ByDay`, and `ByEmployee` are derived.

- [ ] **Step 5: Carry the presentation metadata into report data**

In the final `ProductionReportData` initializer add:

```csharp
ExcludeSundays = filter.ExcludeSundays,
```

Do not change `FinalMetricLabel`, search labels, or any quantity calculations.

- [ ] **Step 6: Run Application GREEN**

Run:

```bash
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --filter ProductionReportServiceTests --no-restore
```

Expected: all `ProductionReportServiceTests` PASS, including 366-day boundary, soft-delete behavior, filters/search, Sunday-exclusion semantics, and false/omitted compatibility.

- [ ] **Step 7: Commit Application contract**

```bash
git add src/backend/German.Application/Reports/ProductionReportFilter.cs \
  src/backend/German.Application/Reports/ProductionReportData.cs \
  src/backend/German.Application/Reports/ProductionReportService.cs \
  tests/German.Application.Tests/Reports/ProductionReportServiceTests.cs
git commit -m "feat: exclude Sundays from production reports"
```

---

### Task 3: API query parameter and end-to-end workbook filtering

**Files:**
- Modify: `src/backend/German.Api/Endpoints/ReportEndpoints.cs`
- Test: `tests/German.Api.Tests/ReportExportApiTests.cs`

**Interfaces:**
- HTTP query: optional `excludeSundays=true|false`.
- Omitted query maps to `false`.
- Existing endpoint path, response content type, filename, and `ManagerOrAdmin` policy remain unchanged.

- [ ] **Step 1: Write a failing API test with Sunday and Monday data**

Extend the test seeding helper to create two entries under one order/operation:

- Sunday `2026-08-16`, note `sunday-marker`, HC 70, TC 10.
- Monday `2026-08-17`, note `monday-marker`, HC 30, TC 5.

Then request:

```csharp
var excludedResponse = await client.GetAsync(
    "/api/reports/production/export.xlsx?fromDate=2026-08-16&untilDate=2026-08-17&excludeSundays=true");
Assert.AreEqual(HttpStatusCode.OK, excludedResponse.StatusCode);
var excludedDetail = GetWorksheetText(
    await excludedResponse.Content.ReadAsByteArrayAsync(),
    "Chi tiết");
StringAssert.DoesNotContain(excludedDetail, "sunday-marker");
StringAssert.Contains(excludedDetail, "monday-marker");
```

Make a second request without `excludeSundays` and assert both markers are present. This proves backward-compatible endpoint binding, not merely Application behavior.

- [ ] **Step 2: Run API RED**

Run:

```bash
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --filter ReportExportApiTests --no-restore
```

Expected: the new exclusion assertion FAILS because the endpoint does not bind/forward `excludeSundays`.

- [ ] **Step 3: Bind and forward the optional boolean**

Change `ExportProductionAsync` signature by inserting `bool? excludeSundays` after `string? search`:

```csharp
private static async Task<IResult> ExportProductionAsync(
    DateOnly? fromDate,
    DateOnly? untilDate,
    Guid? employeeId,
    Guid? orderId,
    Guid? operationId,
    string? search,
    bool? excludeSundays,
    ProductionReportService service,
    IProductionReportExporter exporter,
    CancellationToken cancellationToken)
```

Construct the filter with:

```csharp
new ProductionReportFilter(
    fromDate,
    untilDate,
    employeeId,
    orderId,
    operationId,
    search,
    excludeSundays ?? false)
```

No authorization or endpoint routing changes.

- [ ] **Step 4: Run API GREEN**

Run:

```bash
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --filter ReportExportApiTests --no-restore
```

Expected: all report export API tests PASS, including anonymous/Worker rejection, Manager/Admin success, invalid range behavior, search forwarding, Sunday exclusion, and omission compatibility.

- [ ] **Step 5: Commit API contract**

```bash
git add src/backend/German.Api/Endpoints/ReportEndpoints.cs \
  tests/German.Api.Tests/ReportExportApiTests.cs
git commit -m "feat: expose Sunday exclusion on report export"
```

---

### Task 4: Management sheet layout cleanup and Vietnamese weekday headers

**Files:**
- Modify: `src/backend/German.Infrastructure/Excel/OpenXmlProductionReportExporter.cs`
- Test: `tests/German.Infrastructure.Tests/Excel/OpenXmlProductionReportExporterTests.cs`

**Interfaces:**
- Consumes `ProductionReportData.ExcludeSundays` from Task 2.
- `Báo cáo quản lý` contains only title/period, horizontal table header, and employee-operation-unit rows for each order block.
- Management date-axis header format is `<weekday> dd/MM/yyyy`.

- [ ] **Step 1: Rewrite the management-sheet test contract to fail on current output**

Update `Export_WritesManagementBlocksWithHorizontalDatePivotAndTotals` so the fixture spans Wednesday 12/08/2026 through Monday 17/08/2026 and assert headers such as:

```csharp
CollectionAssert.AreEqual(
    new[]
    {
        "Nhân viên",
        "CĐ",
        "ĐVT",
        "T4 12/08/2026",
        "T5 13/08/2026",
        "T6 14/08/2026",
        "T7 15/08/2026",
        "CN 16/08/2026",
        "T2 17/08/2026",
        "Tổng HC",
        "Tổng TC",
        "Tổng"
    },
    GetCells(headerRow).Select(cell => cell.InnerText).ToArray());
```

Do not hard-code the second block row number after subtotal removal. Find its title by content:

```csharp
var secondBlockTitle = rows.Single(row =>
    GetCells(row).Any(cell => cell.InnerText == "MÃ SX: 0520 — Sản phẩm 0520"));
Assert.AreEqual("MÃ SX: 0520 — Sản phẩm 0520", GetCells(secondBlockTitle).Single().InnerText);
```

Add:

```csharp
StringAssert.DoesNotContain(
    GetSheetData(document, "Báo cáo quản lý").InnerText,
    "TỔNG THEO CÔNG ĐOẠN");
```

- [ ] **Step 2: Add an exclusion-axis test**

Create a report with `FromDate = 2026-08-15`, `UntilDate = 2026-08-17`, `ExcludeSundays = true`, and rows only for Saturday/Monday. Assert management header text contains:

```text
T7 15/08/2026
T2 17/08/2026
```

and does not contain:

```text
CN 16/08/2026
```

Also assert the row total cells equal the Saturday + Monday quantities. This verifies column indexes are recalculated from the reduced date axis.

- [ ] **Step 3: Run Infrastructure RED**

Run:

```bash
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --filter OpenXmlProductionReportExporterTests --no-restore
```

Expected: FAIL because headers are currently plain dates, Sunday is always included on the axis, and `TỔNG THEO CÔNG ĐOẠN` still exists.

- [ ] **Step 4: Remove the operation subtotal section completely**

In `CreateManagementWorksheet` remove:

```csharp
AddOperationTotals(data, ref row, block, totalStart);
```

Delete the entire `AddOperationTotals(...)` method.

After the final employee row of a block, retain only visual spacing before the next order:

```csharp
row += 3;
```

Do not insert any subtotal/grand-total rows.

- [ ] **Step 5: Build the management date axis from report metadata**

Replace:

```csharp
var days = Dates(report.FromDate, report.UntilDate).ToArray();
```

with:

```csharp
var days = Dates(report.FromDate, report.UntilDate)
    .Where(date => !report.ExcludeSundays || date.DayOfWeek != DayOfWeek.Sunday)
    .ToArray();
```

`totalStart` continues to derive from `days.Length`, so total columns automatically shift left when Sunday columns are removed.

- [ ] **Step 6: Add exact Vietnamese weekday labels**

Add:

```csharp
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
```

Change `AddHeader` from plain `dd/MM/yyyy` to:

```csharp
Text(ManagementDateLabel(days[i]), HeaderStyle)
```

Keep each date merged across exactly two `HC | TC` columns.

- [ ] **Step 7: Run Infrastructure GREEN**

Run:

```bash
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --filter OpenXmlProductionReportExporterTests --no-restore
```

Expected: all exporter tests PASS. Sheet order/active sheet, freeze panes, numeric cells, detail AutoFilter/date formats, multiple Mã SX blocks, weekday labels, Sunday axis behavior, and empty workbook remain valid.

- [ ] **Step 8: Commit workbook layout fix**

```bash
git add src/backend/German.Infrastructure/Excel/OpenXmlProductionReportExporter.cs \
  tests/German.Infrastructure.Tests/Excel/OpenXmlProductionReportExporterTests.cs
git commit -m "fix: align production management workbook layout"
```

---

### Task 5: Full regression verification, evidence, review, push, and PR

**Files:**
- Modify: `docs/testing/production-management-report.tdd.md`
- Review all files changed in Tasks 1–4.

**Interfaces:**
- Final branch must be based on `dev` and PR target exactly `dev`.
- PR must not be merged as part of this task; merge requires a later explicit user request after review.

- [ ] **Step 1: Run focused frontend suite**

From `src/frontend`:

```bash
bun test src/features/production-entries
```

Expected: all production-entry frontend tests PASS.

- [ ] **Step 2: Run full frontend verification**

From `src/frontend`:

```bash
bun test
bun run build
```

Expected: all frontend tests PASS and the production build exits 0.

- [ ] **Step 3: Run full backend verification**

From repository root:

```bash
dotnet build German.sln --configuration Release --no-restore
dotnet test German.sln --configuration Release --no-build
```

Expected: Release build exits 0 with no new warnings; all Domain/Application/Infrastructure/API tests PASS.

- [ ] **Step 4: Verify formatting and diff hygiene**

Run:

```bash
dotnet format German.sln --verify-no-changes --no-restore
git diff --check
git status --short
```

Expected: formatting and whitespace checks exit 0; status contains only the intended branch changes.

- [ ] **Step 5: Build the production Docker image**

Run:

```bash
docker build --tag german:verify-excel-sunday-layout .
```

Expected: Docker production image build exits 0.

- [ ] **Step 6: Append factual TDD evidence**

Update `docs/testing/production-management-report.tdd.md` only after the commands have run. Add a follow-up section listing:

- the focused RED failures observed before implementation;
- the final focused GREEN commands/results;
- full frontend test count;
- full backend test count;
- Release build result;
- Docker build result;
- the guarantees `TỔNG THEO CÔNG ĐOẠN` absent, weekday labels present, default FE Sunday exclusion, true/false API compatibility.

Do not invent counts or outcomes; copy the actual command results.

- [ ] **Step 7: Commit verification evidence**

```bash
git add docs/testing/production-management-report.tdd.md
git commit -m "docs: record Sunday export verification"
```

- [ ] **Step 8: Run pre-completion verification again on final HEAD**

Because the evidence commit changes final HEAD, rerun at minimum:

```bash
bun test
bun run build
dotnet build German.sln --configuration Release --no-restore
dotnet test German.sln --configuration Release --no-build
git diff --check
```

Expected: every command exits 0 on the exact commit that will be pushed.

- [ ] **Step 9: Review the cumulative branch diff against `dev`**

Review `dev...HEAD` for:

- no `ProductionCalculator` changes;
- no auth policy changes;
- no DB migrations/dependencies;
- `excludeSundays` is export-only on FE;
- omitted HTTP parameter maps false;
- Sunday data is excluded before report aggregates when true;
- exporter does not recalculate HC/TC;
- `TỔNG THEO CÔNG ĐOẠN` is absent;
- weekdays map exactly T2/T3/T4/T5/T6/T7/CN;
- all total-column indexes derive from the filtered date axis;
- workbook remains `Báo cáo quản lý`, `Tổng quan`, `Chi tiết` in that order.

Fix any Critical/Important finding before pushing. Re-run impacted tests after every fix.

- [ ] **Step 10: Push branch and create PR into `dev`**

Push:

```bash
git push -u origin fix/excel-sunday-layout
```

Create one PR with:

- base: `dev`
- head: `fix/excel-sunday-layout`
- title: `Fix production Excel Sunday filtering and management layout`
- summary covering removal of operation subtotal, weekday header labels, frontend default Sunday exclusion, and backend whole-workbook filtering.
- verification section containing only freshly observed final-HEAD results.

Do not target or modify `main`.

- [ ] **Step 11: Verify PR metadata and CI on the exact head SHA**

Confirm the PR is open, mergeable if GitHub can determine it, and targets `dev`. Fetch workflow runs for the exact PR head SHA and wait for frontend/backend/Docker jobs to complete successfully before reporting that the PR is ready for review.

Do not merge the PR in this task.
