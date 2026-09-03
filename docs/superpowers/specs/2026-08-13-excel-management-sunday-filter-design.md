# Excel Sunday Filter and Management Layout Fix

## Context

The production Excel export currently includes a `TỔNG THEO CÔNG ĐOẠN` section that is not part of the approved management layout. The export dialog also has no way to exclude Sundays, and management date headers do not show weekday labels.

This change keeps the approved management layout focused on one horizontal table per production order:

`Nhân viên | CĐ | ĐVT | [ngày HC/TC...] | Tổng HC | Tổng TC | Tổng`

## Goals

1. Remove `TỔNG THEO CÔNG ĐOẠN` completely from `Báo cáo quản lý`.
2. Add Vietnamese weekday prefixes to management date headers, for example `T2 17/08/2026` and `CN 23/08/2026`.
3. Add a frontend export option `Bỏ Chủ nhật`, checked by default whenever the export dialog opens.
4. When `Bỏ Chủ nhật` is checked, Sunday entries are excluded from the entire exported workbook, not only hidden from the management sheet.
5. Preserve the existing architecture, authorization, filters, ProductionCalculator behavior, and 366-day maximum export range.

## UX Design

`ProductionExportDialog` adds one checkbox below the date range controls:

- Label: `Bỏ Chủ nhật`
- Default: checked
- Reinitialized to checked whenever the dialog is opened.

On export the dialog returns `fromDate`, `untilDate`, and `excludeSundays`.

The production list page passes this value into the export URL builder together with the current applied business filters.

`buildProductionExportUrl` emits `excludeSundays=true` when the option is checked. The frontend default is responsible for making normal manager exports exclude Sundays. The backend remains backward compatible: requests that omit the parameter behave as `excludeSundays=false`.

## Backend Contract

`GET /api/reports/production/export.xlsx` accepts a new optional boolean query parameter `excludeSundays` and passes it into `ProductionReportFilter`.

`ProductionReportService` applies the Sunday exclusion before materializing `ProductionReportRow` values. When enabled, rows whose `WorkDate.DayOfWeek == DayOfWeek.Sunday` are excluded from the report dataset.

Because `Summary`, `ByDay`, and `ByEmployee` are calculated from the filtered rows, Sunday quantities are also excluded from `Báo cáo quản lý`, row totals, `Tổng quan`, and `Chi tiết`.

## Report Data

`ProductionReportData` carries `ExcludeSundays` so the exporter can build the horizontal date axis consistently with the report dataset. This is report presentation metadata, not domain calculation logic.

## Management Sheet

Each production order remains one block in the same `Báo cáo quản lý` sheet. The block contains only title/period metadata, the two-row horizontal table header, and employee-operation-unit rows.

After the last employee row, the block ends. If another production order exists, leave visual spacing and start the next block.

The exporter removes the `AddOperationTotals(...)` call, removes the helper if unused, and removes all `TỔNG THEO CÔNG ĐOẠN` content. No replacement subtotal or grand-total section is added below the table.

## Date Axis and Labels

The exporter generates the management date axis from `FromDate` through `UntilDate` inclusive.

When `ExcludeSundays == true`, Sunday dates are omitted from the axis entirely. When false, all dates are included.

Header format:

- Monday: `T2 dd/MM/yyyy`
- Tuesday: `T3 dd/MM/yyyy`
- Wednesday: `T4 dd/MM/yyyy`
- Thursday: `T5 dd/MM/yyyy`
- Friday: `T6 dd/MM/yyyy`
- Saturday: `T7 dd/MM/yyyy`
- Sunday: `CN dd/MM/yyyy`

Each date still owns two columns: `HC | TC`.

Existing three frozen columns remain `Nhân viên | CĐ | ĐVT`.

## Data Semantics

The exporter continues to aggregate existing `HcQuantity` and `TcQuantity` only. It must not recalculate HC/TC from shifts or overtime.

Row identity remains `ProductionOrder + Employee + Operation + Unit`.

Row totals remain `Tổng HC`, `Tổng TC`, and `Tổng`. No cross-operation quantity grand total is introduced.

## Architecture

Keep the current boundaries:

- `German.Application`: report filter and query semantics
- `German.Infrastructure`: OpenXML layout/pivot rendering
- `German.Api`: thin query-parameter mapping
- frontend: export option and request construction

Do not add repositories, dependencies, database migrations, or frontend date libraries.

## Error and Compatibility Behavior

`excludeSundays` is optional at the HTTP level. Omitted or false means Sundays remain included, preserving compatibility for existing direct API consumers. The frontend sends true by default through the checked option.

Existing validation remains unchanged: invalid date ranges remain rejected and the maximum export range remains 366 calendar days. The 366-day validation is based on the requested calendar range, not the number of days remaining after Sundays are removed.

## Tests

### Frontend

Verify:

- `Bỏ Chủ nhật` is checked when the export dialog opens
- reopening the dialog resets it to checked
- export payload includes `excludeSundays: true` by default
- unchecking exports with `excludeSundays: false`
- export URL carries the boolean parameter

### Application

With Sunday and weekday entries verify:

- true removes Sunday rows
- summary excludes Sunday quantities
- by-day excludes Sunday
- by-employee excludes Sunday quantities
- false preserves Sunday data

### API

Verify endpoint binding of `excludeSundays` without changing Manager/Admin authorization.

### Infrastructure

Verify:

- `TỔNG THEO CÔNG ĐOẠN` does not appear
- multiple Mã SX blocks still work
- date headers use `T2` through `T7` and `CN`
- Sunday date columns are absent when true
- Sunday columns are present and labeled `CN` when false
- row totals remain numeric and correct
- sheet order and active sheet remain unchanged
- freeze pane remains three left columns plus management header rows

## Verification

Before opening the PR, run fresh verification on the final branch head:

- backend test suite
- frontend test suite
- Release build
- frontend production build
- Docker production build

## Acceptance Criteria

1. `TỔNG THEO CÔNG ĐOẠN` is completely absent from `Báo cáo quản lý`.
2. The management table remains `Nhân viên | CĐ | ĐVT | ngày HC/TC | Tổng HC | Tổng TC | Tổng`.
3. Date headers include Vietnamese weekday prefixes.
4. `Bỏ Chủ nhật` exists in the export dialog and defaults to checked.
5. Checked means Sunday production is excluded from every workbook sheet and all exported aggregates.
6. Unchecked means Sundays are exported normally and management headers show `CN`.
7. Direct API callers that omit the new parameter continue to include Sundays.
8. No ProductionCalculator, authorization, database schema, dependency, or 366-day-range behavior changes.
