# Excel production management report TDD evidence

Source: `pasted-text-1.txt` supplied for the production export redesign.

## User journeys

- As a manager, I want the workbook to open on a horizontal management report so that daily production can be compared across a period.
- As a manager, I want multiple production orders in separate blocks on one sheet so that I can review the export without navigating many sheets.
- As an auditor, I want the existing overview and detail sheets preserved so that I can reconcile the management report with source entries.

## RED / GREEN evidence

The exporter tests were changed first and run before production code changes:

```text
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --filter OpenXmlProductionReportExporterTests --no-restore
Failed: 5, Passed: 1, Total: 6
```

After implementing the management sheet and pivot:

```text
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --filter OpenXmlProductionReportExporterTests --no-restore
Passed: 6, Failed: 0, Total: 6
```

## Guarantees

| Guarantee | Evidence | Result |
|---|---|---|
| Sheet order and active sheet | `OpenXmlProductionReportExporterTests.Export_CreatesManagementOverviewAndDetailSheetsInOrderAndActivatesManagementSheet` | PASS |
| Horizontal date pivot, multiple blocks, row totals, operation/unit separation | `OpenXmlProductionReportExporterTests.Export_WritesManagementBlocksWithHorizontalDatePivotAndTotals` | PASS |
| Freeze three columns and two header rows | `OpenXmlProductionReportExporterTests.Export_ManagementSheetFreezesThreeColumnsAndHeaderRows` | PASS |
| Existing overview and detail behavior | `OpenXmlProductionReportExporterTests.Export_WritesOverviewMetadataMetricsAndAggregateTotals`, `Export_WritesDetailHeadersAndExcelUsabilityFeatures` | PASS |
| Empty export remains a valid three-sheet workbook | `OpenXmlProductionReportExporterTests.Export_EmptyRowsStillCreatesValidThreeSheetWorkbook` | PASS |

## Regression verification

- `dotnet test German.sln --no-restore`: 82 passed, 0 failed.
- `dotnet build German.sln --no-restore --configuration Release`: 0 warnings, 0 errors.
- `bun test`: 85 passed, 0 failed.
- `docker build --tag german:production-excel-management .`: passed.

No dependencies, authorization, filter semantics, ProductionCalculator, or frontend export API contract were changed.

## Sunday exclusion / management layout follow-up — 2026-08-13

### RED evidence

The follow-up was exercised as separate test-first failures before each production change:

- Frontend RED: GitHub Actions run `31705977019` on head `2252ea4f...` failed the frontend job because the export URL did not serialize `excludeSundays` and the `Bỏ Chủ nhật` checkbox did not exist. Backend and Docker jobs remained green.
- Application RED: GitHub Actions run `31707182621` failed backend compilation because the test required the seventh `ProductionReportFilter` argument (`ExcludeSundays`) before that contract existed.
- API RED: GitHub Actions run `31708249238` on head `30e5545...` passed build, Domain, Application, and Infrastructure, then failed `Test API` because the endpoint did not yet forward `excludeSundays`.
- Infrastructure RED: GitHub Actions run `31708887897` on head `230644...` passed build, Domain, and Application, then failed `Test infrastructure` because the management sheet still used plain date headers, included Sunday on the axis, and rendered `TỔNG THEO CÔNG ĐOẠN`.

### GREEN verification before this evidence commit

GitHub Actions run `31710621376` verified implementation head `91d6df0141a4c54033beb0ddd58261875dc5da97`:

- Frontend: 89 passed, 0 failed across 25 files; production build passed.
- Release backend build: 0 warnings, 0 errors.
- Domain: 9 passed, 0 failed.
- Application: 39 passed, 0 failed.
- Infrastructure: 8 passed, 0 failed.
- API: 30 passed, 0 failed.
- Backend total: 86 passed, 0 failed.
- Docker job: deployment helper, Compose validation, and production image build passed.

### Follow-up guarantees

| Guarantee | Evidence | Result |
|---|---|---|
| `Bỏ Chủ nhật` is checked by default for every newly opened export dialog | `ProductionExportSundayOption.test.js`, `productionExport.test.js` | PASS |
| Export-only URL carries `excludeSundays=true|false`; list API does not | `productionEntryQuery.test.js` | PASS |
| `excludeSundays=true` removes Sunday before rows and report aggregates are derived | `ProductionReportSundayTests.BuildAsync_ExcludeSundays_RemovesSundayFromRowsAndAggregates` | PASS |
| HTTP omission remains backward compatible and includes Sunday | `ReportExportSundayApiTests.Export_ExcludeSundaysTrue_RemovesSundayWhileOmittedParameterKeepsIt` | PASS |
| Management date headers use exact `T2`–`T7` / `CN` prefixes | `OpenXmlProductionReportSundayTests`, `OpenXmlProductionReportExporterTests` | PASS |
| Sunday columns are absent when excluded and present as `CN` when included | `OpenXmlProductionReportSundayTests` | PASS |
| `TỔNG THEO CÔNG ĐOẠN` is absent from the management sheet | `OpenXmlProductionReportSundayTests`, `OpenXmlProductionReportExporterTests` | PASS |
| Workbook remains `Báo cáo quản lý`, `Tổng quan`, `Chi tiết`, with management active | `OpenXmlProductionReportExporterTests` | PASS |

`ProductionCalculator`, authorization policy, database schema, dependencies, and the 366-day export limit were not changed by this follow-up.
