# Production external quantity — TDD evidence

## User journeys

- As a Manager/Admin, I want to record an external receipt against one production order and operation so that it contributes to the operation report without creating a fake employee entry.
- As a Manager/Admin, I want to edit, list, and delete each external receipt so that incorrect receipts can be corrected without changing internal production history.
- As a Manager, I want the operation report to show internal, external, and combined quantities while keeping zero-output operations visible and mixed units independently scaled.
- As a Worker, I must not be able to manage external receipts.

## TDD checkpoints

- RED: `ProductionExternalQuantityServiceTests` and the report constructor regressions failed to compile because the external entity/service/report fields did not exist.
- `c727689` — added the RED tests for CRUD, validation, authorization, report aggregation, external-only/zero operation behavior, and chart rendering.
- GREEN: `fb1135d` — added the domain entity, application service, DbContext contract/configuration, report aggregation, API registration, and error mapping. Focused application tests passed 20/20.
- `99db228` — added the EF migration, model metadata test, and API integration coverage for Manager CRUD, Worker authorization, invalid quantities, and preservation of internal entries.
- `d363439` — added the order-detail popup/history/edit/delete UI and stacked external report segment. Focused frontend tests passed 8/8.

## Guarantees

| Guarantee | Evidence | Result |
|---|---|---|
| External receipt quantity must be greater than zero | `ProductionExternalQuantityServiceTests.Create_RejectsNonPositiveQuantityAndMismatchedOperation`; API invalid-quantity test | PASS |
| Operation must belong to the selected order | Application mismatch test | PASS |
| Manager/Admin can create, list, update, and delete receipts | `ProductionExternalQuantityApiTests.ManagerCanCreateListUpdateAndDeleteWithoutChangingInternalEntries` | PASS |
| Worker cannot manage receipts | `ProductionExternalQuantityApiTests.WorkerCannotManageExternalQuantity` | PASS |
| Deleting an external receipt does not touch `ProductionEntry` | Application and API CRUD tests | PASS |
| Source and note are trimmed and constrained by the persistence model | Application CRUD test and `ProductionExternalQuantityModelTests` | PASS |
| Migration contains decimal precision, text limits, FKs, and composite query index | `20260822035922_AddProductionExternalQuantities` and infrastructure model test | PASS |
| Report keeps every order operation, including zero output | `ProductionReportServiceTests.BuildOperationSummaryAsync_AddsExternalQuantityAndKeepsZeroOperation` | PASS |
| Report filters external quantities by order, operation, and date range | Application report aggregation and API summary tests | PASS |
| Report exposes internal, external, and combined totals | Application and API summary tests | PASS |
| Chart renders HC, TC, internal, external, and combined total values | `ProductionOperationSummaryChart.external.test.js` | PASS |
| Mixed units remain independently scaled | Existing `ReportPage.test.js` plus external chart test | PASS |
| Mã SX detail exposes external receipt popup and history actions | `ProductionExternalQuantityDialog.test.js` and `ProductionOrderListPage.jsx` flow | PASS |

## Verification

```text
dotnet test German.sln --configuration Release --no-restore
9 Domain + 96 Application + 18 Infrastructure + 62 API = 185 passed

dotnet build German.sln --configuration Release --no-restore /p:TreatWarningsAsErrors=true
0 warnings, 0 errors

bun test
205 pass, 0 fail, 613 expect() calls

bun run build
frontend production build passed

dotnet ef migrations has-pending-model-changes --project src/backend/German.Infrastructure --startup-project src/backend/German.Api --configuration Release --no-build
No changes have been made to the model since the last migration.

git diff --check
clean
```

Coverage was not collected in this run; focused application, infrastructure, API, frontend, full-suite, build, and migration checks were run instead.
