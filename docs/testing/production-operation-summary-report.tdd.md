# Production operation summary report — TDD evidence

## User journeys

- As a manager, I want to choose a production order and date range so that I can review its operation-level output.
- As a manager, I want every operation belonging to the selected order to remain visible, including operations with zero output.
- As a manager, I want HC, TC, total quantity, and unit details beside each operation bar so that mixed-unit orders remain understandable.

## TDD checkpoints

- RED: `ProductionReportServiceTests.BuildOperationSummaryAsync` failed to compile because the DTO and aggregation method did not exist.
- `07213fd` — added application tests for order/date filtering, aggregation, mixed units, and zero-output operations.
- GREEN: `73d4619` adds `ProductionOperationSummary`, full-order operation aggregation, and the missing-order API mapping; the targeted application tests passed 2/2.
- `f4a2b43` — added the Manager/Admin JSON endpoint and API integration coverage.
- RED: `ReportPage.test.js` failed because the operation summary component did not exist.
- `b1cc225` — added frontend rendering and URL contract tests.
- GREEN: `538729c` adds the dropdown-driven report view and HC/TC stacked bars; targeted frontend tests passed.
- `513f967` — loads the full production-order list so historical orders remain available in the report selector.
- `a9142f0` — added the mixed-unit chart regression test.
- `e38b35d` — groups bars by unit and calculates an independent scale per unit.

## Guarantees

| Guarantee | Evidence | Result |
|---|---|---|
| Summary aggregates HC, TC, and total by selected order and operation | `ProductionReportServiceTests.BuildOperationSummaryAsync_AggregatesByOrderAndOperationIncludingZeroAndMixedUnits` | PASS |
| Date and order filters do not leak entries from another date/order | `ProductionReportServiceTests.BuildOperationSummaryAsync_FiltersOrderAndDateRange` | PASS |
| Operations with no production remain in the response with zero values | Application and API summary tests | PASS |
| JSON endpoint returns order metadata and operation summaries to Manager | `ReportExportApiTests.Summary_Manager_ReturnsAllOrderOperationsIncludingZeroAndFiltersByDate` | PASS |
| Report page exposes Mã SX/date controls and summary URL | `ReportPage.test.js` | PASS |
| Mixed units and HC/TC/total detail render beside operation bars | `ReportPage.test.js` and `ProductionOperationSummaryChart.jsx` | PASS |
| Different units are never compared on one bar scale | `ReportPage.test.js:groups operation bars by unit and scales each unit independently` | PASS |
| Loading, empty, and error states are present in the report view | `ReportPage.jsx` state branches | PASS |

## Verification

```text
bun test
198 pass, 0 fail, 582 expect() calls

bun run build
production build passed

dotnet test German.sln --configuration Release --no-restore
9 Domain + 92 Application + 17 Infrastructure + 59 API = 177 passed

dotnet build German.sln --configuration Release --no-restore
0 warnings, 0 errors
```

Coverage was not collected in this run; the repository's normal frontend/backend test suites and targeted integration tests were used instead.
