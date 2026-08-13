# Production export range TDD evidence

Source intent: review findings for PR #5 at head `56ab0fd0e4b878d95ece302b96145ed4ae754c9f`.

User journeys:

- As a Manager/Admin, I can export a custom 32–366 day range even when the list itself is limited to 31 days.
- As a user, I can distinguish a date-group count as page-local and see Vietnamese entry-mode labels in Excel.

## Evidence

| Guarantee | Test | RED | GREEN |
|---|---|---|---|
| Export allows 32 inclusive days | `productionExport.test.js` | Missing `productionExport.js` | PASS |
| Export allows 366 inclusive days and rejects 367 | `productionExport.test.js` | Missing `productionExport.js` | PASS |
| List remains limited to 31 inclusive days | `productionExport.test.js` | Missing `productionExport.js` | PASS |
| Export dialog exposes Ngày/Tuần/Tháng/Tùy chọn and custom dates | `ProductionExportDialog.test.js` | Missing dialog module | PASS |
| Excel maps `Direct` to `HC / TC trực tiếp` | `OpenXmlProductionReportExporterTests.cs` | Expected Vietnamese label, received `Direct` | PASS |
| Existing responsive/grouped-table contracts remain green | `bun test` | N/A | PASS |

Validation commands:

- `bun test` — 85 passed, 0 failed.
- `bun run build` — passed.
- `dotnet build German.sln --configuration Release --no-restore` — passed with 0 warnings and 0 errors.
- `dotnet test German.sln --configuration Release --no-build` — 80 passed, 0 failed.
- `git diff --check` — passed.

Coverage was not run because the repository has no configured frontend coverage script and no coverage threshold was changed. Docker verification was attempted but the local Docker Desktop Linux daemon was unavailable.

Checkpoint commits:

- `4366122` — regression tests (RED evidence preserved).
- `a5042a3` — implementation and GREEN validation.

## Follow-up design-contract fix

The export dialog's visible range now formats ISO values through `formatDisplayDate()` while date inputs and API query values remain ISO. The regression assertion is in `ProductionExportDialog.test.js` and passed with `bun test`.
