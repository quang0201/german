# Production Monthly Matrix Implementation Plan

> **Status (2026-08-14):** The original implementation and CI verification are complete. The plan below is retained as a historical checklist; `docs/testing/production-monthly-matrix.tdd.md` is the authoritative evidence record. Post-review concurrency and quick-create safeguards were added in commits `41a17a5` and `e7346ee`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Manager/Admin production-entry list with a one-month horizontal matrix that supports safe cell create/edit and atomic multi-operation Direct entry from a day header while leaving the Worker experience unchanged.

**Architecture:** Add a dedicated Manager/Admin monthly-matrix query in `German.Application`, exposed through a thin Minimal API endpoint. Keep existing single-entry create/update/delete endpoints for cell operations, add one application-level atomic batch-direct command for day-header entry, and split the Manager/Admin frontend into focused month-matrix components while preserving the current Worker list path.

**Tech Stack:** React 19, Bun 1.3.14, ASP.NET Core 10 Minimal APIs, EF Core, PostgreSQL, MSTest, existing Tailwind/layout utilities and ERP CSS tokens. No new dependency.

## Global Constraints

- Target branch is `dev`; implementation branch is `feat/production-monthly-matrix`.
- Manager/Admin matrix is exactly one calendar month at a time.
- Worker production-entry screen and permissions remain unchanged.
- Left sticky columns are `Nhân viên | CĐ`.
- Right sticky columns are `Tổng HC | Tổng TC | Tổng`.
- Day headers use `T2`–`T7`/`CN` with `dd/MM`, each with `HC | TC` subcolumns.
- Sundays are hidden by default on FE; when hidden they are excluded from matrix rows and totals.
- `Mã SX` and `ĐVT` are not normal matrix columns.
- Multiple Mã SX use vertical order blocks under one shared day axis.
- Employee names are grouped/row-spanned across that employee's operation rows within one Mã SX block.
- Clicking an empty cell creates one Direct entry; clicking one Direct entry edits it with optimistic concurrency.
- One non-Direct entry opens the existing full detail/edit flow; multiple entries open a record chooser and never overwrite an aggregate.
- Clicking a day header opens batch input for one employee + one Mã SX + multiple operations, with independent HC/TC per operation.
- Batch Direct save is all-or-nothing and rejects any selected matrix key that already has active data.
- Do not modify `ProductionCalculator` formulas or rounding.
- Preserve soft-delete and Manager/Admin audit logging for update/delete.
- Preserve independent Excel export range and current Excel behavior.
- Do not add database migrations or third-party packages.

---

## File Structure

### Backend matrix query
- Create `src/backend/German.Application/ProductionEntries/ProductionMonthlyMatrixQuery.cs`.
- Create `src/backend/German.Application/ProductionEntries/ProductionMonthlyMatrixResult.cs`.
- Create `src/backend/German.Application/ProductionEntries/ProductionMonthlyMatrixService.cs`.
- Modify `src/backend/German.Api/Endpoints/ProductionEntryEndpoints.cs`.
- Test `tests/German.Application.Tests/ProductionEntries/ProductionMonthlyMatrixServiceTests.cs`.
- Test `tests/German.Api.Tests/ProductionEntryMonthlyMatrixApiTests.cs`.

### Backend batch Direct write
- Create `src/backend/German.Application/ProductionEntries/CreateProductionEntryBatchDirectCommand.cs`.
- Modify `src/backend/German.Application/ProductionEntries/ProductionEntryService.cs`.
- Create `src/backend/German.Api/Contracts/ProductionEntries/CreateProductionEntryBatchDirectRequest.cs`.
- Modify `src/backend/German.Api/Endpoints/ProductionEntryEndpoints.cs`.
- Test `tests/German.Application.Tests/ProductionEntries/ProductionEntryBatchDirectTests.cs`.
- Test `tests/German.Api.Tests/ProductionEntryBatchDirectApiTests.cs`.

### Frontend matrix
- Create `src/frontend/src/features/production-entries/productionMonthlyMatrix.js` and tests.
- Create `ProductionMonthNavigator.jsx`, `ProductionMonthlyMatrix.jsx` and tests.
- Create `ProductionMatrixQuickEntryDialog.jsx`, `ProductionMatrixBatchEntryDialog.jsx`, `ProductionMatrixCellRecordsDialog.jsx` and focused tests.
- Modify `ProductionEntryListPage.jsx` and `src/frontend/src/styles.css`.

### Verification
- Create `docs/testing/production-monthly-matrix.tdd.md` with observed evidence only.

---

### Task 1: Monthly matrix application query

**Files:**
- Create: `src/backend/German.Application/ProductionEntries/ProductionMonthlyMatrixQuery.cs`
- Create: `src/backend/German.Application/ProductionEntries/ProductionMonthlyMatrixResult.cs`
- Create: `src/backend/German.Application/ProductionEntries/ProductionMonthlyMatrixService.cs`
- Test: `tests/German.Application.Tests/ProductionEntries/ProductionMonthlyMatrixServiceTests.cs`

**Interfaces:**

```csharp
public sealed record ProductionMonthlyMatrixQuery(
    int Year, int Month, Guid? EmployeeId, Guid? OrderId,
    Guid? OperationId, string? Search, bool ExcludeSundays = true);

public sealed record ProductionMonthlyMatrixSummary(
    int EmployeeCount, int EntryCount, decimal HcQuantity,
    decimal TcQuantity, decimal TotalQuantity);

public sealed record ProductionMatrixRecordDto(
    Guid Id, int Version, ProductionEntryMode EntryMode,
    decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity, string? Note);

public sealed record ProductionMatrixCellDto(
    DateOnly WorkDate, decimal HcQuantity, decimal TcQuantity,
    decimal TotalQuantity, int EntryCount,
    IReadOnlyList<ProductionMatrixRecordDto> Records);

public sealed record ProductionMatrixOperationRowDto(
    Guid OperationId, int OperationNumber, string OperationName,
    decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity,
    IReadOnlyList<ProductionMatrixCellDto> Cells);

public sealed record ProductionMatrixEmployeeGroupDto(
    Guid EmployeeId, string EmployeeCode, string EmployeeName,
    IReadOnlyList<ProductionMatrixOperationRowDto> Operations);

public sealed record ProductionMatrixOrderBlockDto(
    Guid OrderId, string OrderCode, string ProductName,
    IReadOnlyList<ProductionMatrixEmployeeGroupDto> Employees);

public sealed record ProductionMatrixOrderOptionDto(Guid Id, string Code, string ProductName);

public sealed record ProductionMonthlyMatrixResult(
    DateOnly FromDate, DateOnly UntilDate, bool ExcludeSundays,
    ProductionMonthlyMatrixSummary Summary,
    IReadOnlyList<ProductionMatrixOrderOptionDto> AvailableOrders,
    IReadOnlyList<ProductionMatrixOrderBlockDto> Orders);
```

- [ ] **Step 1: Write matrix month-boundary and grouping tests** — prove August 2026 is `2026-08-01..31`, leap February 2028 has 29 days, two Mã SX form two blocks, one employee with three CĐ is one employee group with three operation rows, and row totals equal visible cells.
- [ ] **Step 2: Write Sunday/filter tests** — seed Sunday `2026-08-16` and Monday `2026-08-17`; verify `ExcludeSundays` and exact employee/order/operation/search semantics.
- [ ] **Step 3: Write cell metadata tests** — prove zero, one Direct, one non-Direct, and multiple-record matrix keys keep exact entry IDs, versions, modes and notes.
- [ ] **Step 4: Run RED:** `dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-restore --filter ProductionMonthlyMatrixServiceTests`.
- [ ] **Step 5: Implement service** — reject month outside 1..12 with `production_matrix.invalid_month`; derive calendar bounds; query/join employee/order/operation; apply filters and Sunday exclusion before materialization; group after materialization. `AvailableOrders` is computed before `OrderId`; `Orders` and `Summary` apply `OrderId` so toolbar choices remain while selected-order totals reconcile.
- [ ] **Step 6: Run the same command GREEN.**
- [ ] **Step 7: Commit:** `git commit -m "feat: add monthly production matrix query"` with the three application files and test.

---

### Task 2: Monthly matrix API endpoint

**Files:** modify `ProductionEntryEndpoints.cs`; test `ProductionEntryMonthlyMatrixApiTests.cs`.

**Endpoint:** `GET /api/production-entries/monthly-matrix?year=2026&month=8&employeeId=&orderId=&operationId=&search=&excludeSundays=true`.

- [ ] **Step 1:** RED tests: anonymous 401, Worker 403, Manager/Admin allowed, binding works, omitted `excludeSundays` defaults true, response includes summary/orders/cell records.
- [ ] **Step 2:** run `dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-restore --filter ProductionEntryMonthlyMatrixApiTests` and confirm RED.
- [ ] **Step 3:** map `group.MapGet("/monthly-matrix", GetMonthlyMatrixAsync).RequireAuthorization("ManagerOrAdmin")` before `/{id:guid}`. Bind nullable filters and `bool? excludeSundays`, pass `excludeSundays ?? true` to the application service, and use `ApiResultMapper.Error` for failures.
- [ ] **Step 4:** rerun GREEN and commit `feat: expose monthly production matrix`.

---

### Task 3: Atomic batch Direct creation

**Files:** create `CreateProductionEntryBatchDirectCommand.cs`; modify `ProductionEntryService.cs`; test `ProductionEntryBatchDirectTests.cs`.

```csharp
public sealed record CreateProductionEntryBatchDirectItem(
    Guid ProductionOperationId, decimal? DirectHcQuantity,
    decimal? DirectTcQuantity, string? Note);

public sealed record CreateProductionEntryBatchDirectCommand(
    DateOnly WorkDate, Guid EmployeeId, Guid ProductionOrderId,
    IReadOnlyList<CreateProductionEntryBatchDirectItem> Items);

public sealed record CreateProductionEntryBatchDirectResult(
    int CreatedCount, IReadOnlyList<ProductionEntryDto> Entries);
```

- [ ] **Step 1:** RED tests prove Worker forbidden; empty batch fails; duplicate op IDs fail; wrong-order op fails; inactive/missing references reuse current errors; invalid Direct values fail via `ProductionCalculator`; any existing selected matrix key causes `production_entry.batch_conflict` and zero new rows; successful CĐ4/CĐ5/CĐ6/CĐ100 request creates exactly four Direct rows with exact HC/TC/Total.
- [ ] **Step 2:** run `dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-restore --filter ProductionEntryBatchDirectTests` and confirm RED.
- [ ] **Step 3:** implement `CreateBatchDirectAsync`. Validate Manager/Admin, non-empty items and unique op IDs; validate all references before staging; query conflicts for the full `(date, employee, order, opIds)` set; calculate every item with `ProductionCalculator` in Direct mode; stage only after every item validates; call one `SaveChangesAsync`; return created DTOs. Never call `CreateAsync` in a loop.
- [ ] **Step 4:** rerun GREEN and commit `feat: add atomic production batch entry`.

---

### Task 4: Batch Direct API endpoint

**Files:** create `CreateProductionEntryBatchDirectRequest.cs`; modify `ProductionEntryEndpoints.cs`; test `ProductionEntryBatchDirectApiTests.cs`.

```csharp
public sealed record CreateProductionEntryBatchDirectItemRequest(
    Guid ProductionOperationId, decimal? DirectHcQuantity,
    decimal? DirectTcQuantity, string? Note);
public sealed record CreateProductionEntryBatchDirectRequest(
    DateOnly WorkDate, Guid EmployeeId, Guid ProductionOrderId,
    IReadOnlyList<CreateProductionEntryBatchDirectItemRequest> Items);
```

- [ ] **Step 1:** RED API tests for Worker 403, Manager success, conflict creates none, empty batch maps application error.
- [ ] **Step 2:** add `POST /api/production-entries/batch-direct` with `ManagerOrAdmin`, map request one-to-one to application command, return `Ok` or mapped error.
- [ ] **Step 3:** rerun API tests GREEN and commit `feat: expose production batch entry endpoint`.

---

### Task 5: Frontend month/query helpers

**Files:** create `productionMonthlyMatrix.js` and test.

```js
export function currentMonthKey(isoDate) {}
export function shiftMonth(monthKey, direction) {}
export function monthLabel(monthKey) {}
export function monthDateAxis(monthKey, excludeSundays) {}
export function buildProductionMonthlyMatrixUrl(filters) {}
export function matrixCellAction(cell) {}
```

- [ ] **Step 1:** RED tests for year rollover, leap February, weekday labels, Sunday exclusion, URL encoding/default Sunday=true, and actions `create | edit-direct | open-entry | choose-record` for 0/1 Direct/1 non-Direct/2 records.
- [ ] **Step 2:** run `cd src/frontend && bun test src/features/production-entries/productionMonthlyMatrix.test.js` and confirm RED.
- [ ] **Step 3:** implement with native Date/UTC-safe month arithmetic only; no date dependency.
- [ ] **Step 4:** rerun GREEN and commit `feat: add production matrix month helpers`.

---

### Task 6: Matrix rendering and month navigation

**Files:** create `ProductionMonthNavigator.jsx`, `ProductionMonthlyMatrix.jsx`, corresponding test; modify `styles.css`.

`ProductionMonthlyMatrix` consumes `{ data, monthKey, selectedOrderId, excludeSundays, loading, error, onSelectOrder, onToggleSundays, onCellClick, onDayHeaderClick }`.

- [ ] **Step 1:** RED render tests: one shared day header; `Nhân viên | CĐ`; no regular `Mã SX`/`ĐVT` headers; two vertical Mã SX block labels; employee name appears once with `rowSpan=3`; day header `T5 27/08`; Sunday absent when excluded; total headers; cells carry date/employee/order/op identifiers.
- [ ] **Step 2:** implement semantic table with two sticky header rows, order separator rows, employee rowspan, operation rows, blank missing values and numeric actual zero.
- [ ] **Step 3:** CSS: intentional horizontal overflow, two sticky left columns, three sticky totals on desktop, sticky headers, order-block background, clickable header/cell focus states, smaller sticky widths on mobile. Use existing ERP tokens/utilities only.
- [ ] **Step 4:** run `bun test src/features/production-entries/ProductionMonthlyMatrix.test.js` GREEN and commit `feat: render monthly production matrix`.

---

### Task 7: Quick cell edit and multiple-record chooser

**Files:** create `ProductionMatrixQuickEntryDialog.jsx`, `ProductionMatrixCellRecordsDialog.jsx` and focused tests.

- [ ] **Step 1:** RED tests: empty cell opens `Nhập sản lượng` with fixed employee/order/op/date and editable HC/TC/note; POST uses `entryMode: "Direct"`; one Direct entry opens `Chỉnh sửa sản lượng`, PUT includes current `version`, delete includes version; failed save preserves draft. Multiple-record chooser lists each record mode/HC/TC/Total and selecting one calls `onOpenEntry(id)`.
- [ ] **Step 2:** implement with existing `api` and production-entry error helpers. One non-Direct bypasses quick edit and opens existing full detail/edit flow. Never edit an aggregate.
- [ ] **Step 3:** run focused tests GREEN and commit `feat: add production matrix cell editing`.

---

### Task 8: Day-header multi-operation batch dialog

**Files:** create `ProductionMatrixBatchEntryDialog.jsx` and test.

- [ ] **Step 1:** RED tests: clicked header fixes date; employee required; selecting Mã SX loads `/api/production-orders/{id}/operations`; selecting CĐ4/CĐ5/CĐ6/CĐ100 renders four independent `CĐ | HC | TC` rows; deselect removes only that row; button says `Lưu 4 công đoạn`; one request goes to `/api/production-entries/batch-direct`; production HC/TC drafts start blank (preview's 100/0 values are not defaults); conflict keeps popup open and values intact.
- [ ] **Step 2:** implement draft keyed by operation ID: `{ [operationId]: { directHcQuantity: "", directTcQuantity: "", note: "" } }`. Changing order clears selected operations before loading new operations.
- [ ] **Step 3:** submit one atomic request, map blank numbers to null, toast success then close + `onSaved`; on error leave dialog open.
- [ ] **Step 4:** run focused test GREEN and commit `feat: add batch matrix day entry`.

---

### Task 9: Integrate Manager/Admin matrix into production page

**Files:** modify `ProductionEntryListPage.jsx`; update page tests.

- [ ] **Step 1:** RED integration tests: Worker still renders existing period/list/pagination path; Manager/Admin use current month and matrix endpoint with no list pagination; previous/next month change query; Sunday defaults true; selecting order reloads with `orderId`; header click opens batch dialog; cell action dispatches create/edit/open-entry/chooser; successful writes reload; Export retains existing dialog and defaults to current month's first/last date.
- [ ] **Step 2:** preserve Worker path. For Manager/Admin use state `{ monthKey, selectedOrderId, excludeSundays, businessFilters }`, load matrix, render current `ProductionSummary`, compact employee/operation/search filters, month navigator, matrix and dialogs.
- [ ] **Step 3:** production-order filtering comes from matrix toolbar. If selected order disappears from `availableOrders`, reset to `Tất cả mã SX`.
- [ ] **Step 4:** retain current detail-panel navigation for non-Direct/chooser records and mobile route behavior.
- [ ] **Step 5:** run `cd src/frontend && bun test && bun run build` GREEN and commit `feat: switch managers to monthly production matrix`.

---

### Task 10: Final regression, review and PR

**Files:** create `docs/testing/production-monthly-matrix.tdd.md`.

- [ ] **Step 1:** fresh frontend verification: `cd src/frontend && bun test && bun run build`; record exact counts.
- [ ] **Step 2:** fresh backend verification:

```bash
dotnet restore German.sln
dotnet build German.sln -c Release --no-restore
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --no-build -c Release
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-build -c Release
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-build -c Release
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-build -c Release
```

Record exact counts and warnings/errors from final head.

- [ ] **Step 3:** run repository Docker deployment-helper/Compose validation/production image build, or require the exact-head GitHub Actions Docker job to pass.
- [ ] **Step 4:** write observed RED/GREEN evidence only to `docs/testing/production-monthly-matrix.tdd.md`; commit `docs: record monthly matrix verification`.
- [ ] **Step 5:** cumulative review current `dev...HEAD`: authorization, batch partial-save risk, duplicate keys, concurrency, Worker regression, selected-order totals, Sunday reconciliation, month boundaries, responsive sticky behavior, unchanged ProductionCalculator and Excel. Fix every Critical/Important issue before PR.
- [ ] **Step 6:** create PR `feat/production-monthly-matrix` -> `dev`, title `Add monthly production matrix and batch entry workflow`, with exact verification evidence and review findings.
- [ ] **Step 7:** require PR-triggered frontend/backend/Docker CI success on exact HEAD before reporting ready. Do not merge without a later explicit user request.
