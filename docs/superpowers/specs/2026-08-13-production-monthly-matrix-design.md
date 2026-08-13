# Production Monthly Matrix Design

**Date:** 2026-08-13

## Goal

Replace the Manager/Admin production-entry list surface with a stable month matrix that lets managers compare daily HC/TC horizontally, group multiple production orders vertically, edit a single cell safely, and batch-enter multiple operations by clicking a day header.

The Worker experience remains unchanged.

## Approved UX

The approved HTML prototype is represented by the following interaction model:

- The Manager/Admin production view is fixed to one calendar month at a time.
- The day axis runs horizontally for the complete selected month.
- Left sticky columns are `Nhân viên | CĐ`.
- Right sticky columns are `Tổng HC | Tổng TC | Tổng`.
- Each day has two subcolumns: `HC | TC`.
- Day headers use Vietnamese weekday abbreviations, for example `T5 27/08`.
- Sundays are hidden by default and can be shown with `Ẩn Chủ nhật`.
- Employee names use row grouping/rowspan semantics. If one employee works three operations, the employee name is rendered once spanning the three operation rows instead of leaving two visually blank employee cells.
- `Mã SX` and `ĐVT` are not regular table columns.
- If the month contains multiple production orders, the table uses one shared day header and renders production orders as vertical blocks such as `Mã SX: 0417 — Mã hàng 0417` and `Mã SX: 0521 — Áo 0521`.
- The month toolbar provides `Tất cả mã SX` plus one compact selector/tab for each production order present in the selected month. Selecting a code filters the already-loaded matrix client-side; it does not change the month axis.
- The matrix response contains both the overall summary and one summary per production-order block. `Tất cả mã SX` shows the overall summary; selecting `0417` shows the `0417` block summary.
- If only one production order exists in the month, the toolbar collapses to `08/2026 • Mã SX: 0417`.

## Month navigation and existing features

Manager/Admin no longer use day/week/custom list periods on the main production screen. The primary view has previous month, current `MM/yyyy`, and next month controls. The selected month is the data boundary for the matrix and summary.

The existing Excel export action remains and keeps its independent export-range dialog and 366-day export limit. Opening Export from the matrix defaults the export dialog to the currently selected month, but the user may still choose another supported export range.

The existing employee, operation, and search capabilities remain available as compact secondary filters so the redesign does not remove management functionality. Production-order selection is represented by the order-block tabs rather than a duplicated `Mã SX` table column.

## Monthly matrix query

Add a Manager/Admin-only application query and thin API endpoint dedicated to the matrix instead of trying to page through the existing production-entry list endpoint.

Exact endpoint:

`GET /api/production-entries/monthly-matrix?month=2026-08&employeeId=&operationId=&search=&excludeSundays=true`

Rules:

- `month` is required in `yyyy-MM` form.
- The backend derives the first and last date of that month.
- Maximum range is inherently one calendar month.
- `excludeSundays=true` removes Sunday entries before matrix totals and summaries are calculated. FE sends `true` by default; toggling Sunday off/on reloads the matrix so visible columns reconcile with totals.
- Existing soft-delete, employee, operation, and search semantics are preserved.
- The query returns all rows required for the matrix; it is not paginated.
- All production orders represented by matching entries in the selected month are returned in one payload; order tabs are client-side filters.
- The backend owns grouping data and aggregate values; the frontend owns sticky layout and client-side block selection.

The response includes:

- selected month and effective `fromDate`/`untilDate`;
- `excludeSundays`;
- overall summary: employee count, entry count, HC, TC, total;
- production-order blocks with order id/code/product name and block summary;
- employee groups within each order;
- operation rows within each employee;
- day cells with aggregate HC/TC/total and edit metadata;
- operation-row totals.

A matrix cell is keyed by:

`WorkDate + EmployeeId + ProductionOrderId + ProductionOperationId`.

## Existing duplicate-entry safety

The current database does not enforce uniqueness for the matrix cell key; it only indexes `WorkDate + EmployeeId`. Therefore the matrix must not silently overwrite aggregate cells that may contain multiple underlying production entries.

Each cell returns `entryCount` and enough metadata for safe interaction:

- `entryCount = 0`: empty cell; quick create is allowed.
- `entryCount = 1` and the entry is `Direct`: quick HC/TC edit is allowed and carries `entryId` + `version` for optimistic concurrency.
- `entryCount = 1` and the entry uses `ByShift` or `TotalWithOvertime`: the matrix shows the calculated HC/TC aggregate, but clicking it opens the existing full entry edit/detail flow so its original input semantics are preserved.
- `entryCount > 1`: the matrix shows the aggregate plus a small multiple-record indicator. Direct aggregate overwrite is forbidden. Clicking opens `ProductionMatrixCellRecordsDialog`, which lists the underlying record ids, entry modes, HC/TC/total and provides `Xem/Sửa` per record through the existing detail/edit flow.

No database uniqueness migration is introduced in this feature.

## Single-cell quick input/edit

Clicking a normal day cell is independent from clicking the day header.

For an empty cell, open a compact popup with:

- Employee — fixed from row;
- Mã SX — fixed from block;
- CĐ — fixed from row;
- Date — fixed from column;
- HC;
- TC;
- Note.

Saving creates one `Direct` production entry through server-side application logic and the existing ProductionCalculator contract. The frontend never calculates authoritative HC/TC.

For exactly one existing `Direct` entry, the same popup becomes `Chỉnh sửa sản lượng`, prefilled with HC/TC/note and using the current `version`. Manager/Admin may delete that entry from the popup using the existing soft-delete semantics.

After create/update/delete, refresh the matrix rather than manually patching totals in multiple places.

## Day-header batch input

Clicking a day header such as `T5 27/08` opens `Nhập nhanh sản lượng — T5 27/08`.

The popup flow is:

1. Date is fixed from the clicked header.
2. Select one employee.
3. Select one Mã SX.
4. Load active operations for that Mã SX.
5. Select multiple operations using compact operation pills/checks.
6. Each selected operation creates one editable row `CĐ | HC | TC`.
7. HC and TC are entered independently per operation.
8. User can remove an operation from the batch before saving.
9. The primary action shows the number of rows, e.g. `Lưu 4 công đoạn`.

Example selection `CĐ4`, `CĐ5`, `CĐ6`, `CĐ100` produces four independent Direct-entry commands for the same employee/date/order with independent HC/TC values.

## Batch write semantics

Do not implement batch save as independent frontend POST loops because that can leave a partially saved day.

Add an exact Manager/Admin-only endpoint:

`POST /api/production-entries/batch-direct`

Request:

- `workDate`;
- `employeeId`;
- `productionOrderId`;
- items: `{ productionOperationId, directHcQuantity, directTcQuantity, note? }[]`.

Rules:

- At least one item is required.
- Operation ids must be unique within the request.
- Every operation must belong to the selected production order.
- All employee/order/operation authorization and active-reference validations use the same rules as normal production entry creation.
- Every item uses `ProductionEntryMode.Direct`.
- HC/TC validation and authoritative totals stay server-side and reuse ProductionCalculator/service logic; no calculator rewrite.
- Before staging writes, the service checks the matrix key for every selected operation.
- Batch input is a safe create operation: if any selected key already has one or more active production entries, the whole batch fails with a conflict identifying the operations that already contain data. The user edits those cells individually instead of accidentally creating duplicates.
- All validations and calculations complete before entities are staged.
- All new entities are saved by one `SaveChangesAsync`; no item is saved if validation/conflict detection fails for another item.
- The response returns created entries/count so FE can show a success toast, then reload the matrix.

This keeps the header workflow predictable: it is for entering several new operations for one employee/day/order, while existing production is edited through cells.

## Authorization

- Monthly matrix: Manager/Admin only.
- Day-header batch input: Manager/Admin only.
- Cell create: Manager/Admin uses the existing create authorization path; Worker behavior is unchanged on the existing Worker screen.
- Cell update/delete: Manager/Admin only, preserving current server authorization.
- Server authorization remains authoritative; hiding actions on FE is UX only.

## Frontend composition

Keep the existing feature boundary under `src/frontend/src/features/production-entries`.

`ProductionEntryListPage` becomes a thin role dispatcher:

- Worker -> existing list implementation, behavior preserved.
- Manager/Admin -> `ProductionMonthlyMatrixPage`.

The existing Worker list logic is moved into a focused internal/component file without changing its API calls or UX. This prevents Manager matrix effects from running together with legacy list effects.

New focused components:

- `ProductionMonthlyMatrixPage` — month state, secondary filters, matrix loading, export integration and dialog coordination.
- `ProductionMonthNavigator` — previous/current/next month.
- `ProductionMonthlyMatrix` — sticky headers, order blocks, employee rowspan groups, day cells and totals.
- `ProductionMatrixQuickEntryDialog` — one empty/Direct cell.
- `ProductionMatrixBatchEntryDialog` — day-header multi-operation entry.
- `ProductionMatrixCellRecordsDialog` — chooser for aggregate cells with multiple underlying records.

Use focused helpers for month/date-axis generation and matrix query serialization so they can be unit tested without adding a UI testing dependency.

## Responsive behavior

Desktop is the primary matrix surface.

- Horizontal scrolling is intentional.
- `Nhân viên | CĐ` remain sticky on the left.
- Total columns remain sticky on the right where viewport width allows.
- Day header rows remain sticky vertically while scrolling matrix rows.
- On smaller screens, keep the matrix rather than converting it to cards; reduce sticky employee width and allow horizontal scrolling.
- Touch/click targets for day headers and editable cells remain usable.

## Error and concurrency handling

- Matrix load failure uses existing ERP error-state/toast conventions.
- Quick edit sends `version`; `production_entry.version_conflict` uses the existing conflict UX and reloads the matrix after the user acknowledges/reloads.
- Batch conflict lists CĐ numbers already containing data for the selected employee/date/order and saves nothing.
- Invalid/inactive order or operation is rejected server-side.
- A failed save keeps the popup open and preserves entered HC/TC values.
- Successful save closes the popup, shows a toast, and reloads matrix + summary.

## Existing behavior that must not change

- `ProductionCalculator` formulas and rounding.
- Soft-delete behavior.
- Audit logging for Manager/Admin update/delete.
- Current full production entry form and its three entry modes.
- Worker production-entry screen and permissions.
- Excel workbook/export behavior, including `Bỏ Chủ nhật` and independent export range.
- PostgreSQL schema in this feature.
- Existing dependencies; no new third-party package.

## Testing

Application tests:

- matrix month boundaries including February/leap year;
- Sunday exclusion affects rows and all summaries consistently;
- multi-order grouping and per-order summaries;
- employee/operation aggregation;
- cell metadata for zero/one/multiple underlying entries;
- batch validates all operations before saving;
- batch rejects duplicate operation ids;
- batch rejects operations from another order;
- batch rejects any key that already contains production and creates nothing;
- successful batch creates all Direct entries in one save path with correct HC/TC/total;
- existing ProductionCalculator tests remain unchanged.

API tests:

- monthly matrix and batch endpoints require Manager/Admin;
- `yyyy-MM` query binding and validation;
- matrix response contract;
- batch conflict and success HTTP mapping.

Frontend tests:

- month navigation/query serialization;
- Sunday default and toggle;
- multiple Mã SX blocks and client-side order selection;
- summary switches between overall and selected-order summary;
- employee rowspan model;
- day header opens batch dialog with fixed date;
- changing Mã SX reloads available operations;
- selecting multiple operations creates independent HC/TC rows;
- single-cell zero/one/multiple-entry interaction decisions;
- successful writes trigger reload;
- Worker screen remains on existing list flow.

Regression verification:

- full frontend tests/build;
- Domain/Application/Infrastructure/API tests and Release build;
- Docker production image build;
- review cumulative diff against current `dev` before opening PR.

## Pull request target

Implementation branch: `feat/production-monthly-matrix`.

Pull request target: `dev` only. Do not merge to `main` as part of this task.