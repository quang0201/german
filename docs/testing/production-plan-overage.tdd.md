# Production plan overage warning

## User journey

As a manager, I want the production reports to flag an operation when its total exceeds the production plan by more than 100 units, so that I can identify over-production quickly.

## TDD evidence

| Behavior | Test | Result |
|---|---|---|
| A plan of 15,000 allows totals through 15,100 | `productionPlanStatus.test.js` | PASS |
| A total of 15,101 is over the plan | `productionPlanStatus.test.js` | PASS |
| Missing or zero plans do not create a warning | `productionPlanStatus.test.js` | PASS |
| Daily operation rows show the over-plan warning state | `ProductionOperationSummaryChart.external.test.js` | PASS |
| Monthly cells show the over-plan warning state | `ProductionMonthlyOperationTable.test.js` | PASS |

RED validation initially failed because the warning utility and UI state did not exist. GREEN validation passed after the implementation.

Validation commands:

- `bun test src/features/reports/productionPlanStatus.test.js src/features/reports/ProductionOperationSummaryChart.external.test.js src/features/reports/ProductionMonthlyOperationTable.test.js src/features/reports/ReportPage.test.js src/features/reports/ProductionMonthlyReportPage.test.js` — 18 pass.
- `bun test` — 240 pass, 0 fail.
- `bun run build` — completed successfully.

## Implementation

The selected production order's existing `plannedQuantity` is passed to both the daily and monthly report components. The UI displays the plan, the allowed ±100 variance, and the first overage value. Totals above that limit receive the error color and a `Vượt kế hoạch` label. No backend or report service changes are required.

Coverage was not collected; the repository does not define a coverage command in the frontend package scripts.
