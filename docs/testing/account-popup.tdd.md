# Account popup TDD evidence

Source plan: journeys were derived from the requested account-page behavior.

## User journeys

- As an admin, I want to create an account in a popup so the account list stays focused.
- As an admin, I want to edit an account in a popup so I can update its login, role, employee link, password, and active state.

## Evidence

| Guarantee | Test | Result |
|---|---|---|
| Create and edit dialogs render only when opened, show the correct fields, and preserve native validation rules. | `src/frontend/src/features/admin/UserAccountDialog.test.js` | PASS, 5 tests |
| Account page uses popup triggers for create and edit instead of inline account controls. | `src/frontend/src/app/runtimeSafety.test.js` | PASS |
| Account update validates username, worker employee link, duplicate names, password changes, and employee ownership. | `tests/German.Application.Tests/Auth/UserAccountServiceTests.cs` | PASS, 3 tests |
| Admin can update an account through the HTTP endpoint. | `tests/German.Api.Tests/ManagerAdministrationApiTests.cs` | PASS |

RED evidence: frontend initially failed because the popup component was not present; backend initially failed to compile because `UpdateAsync` and `UpdateUserAccountCommand` were absent.

GREEN evidence: `bun test` passed 251 tests; `dotnet test German.sln --no-restore` passed 9 domain, 112 application, 21 infrastructure, and 67 API tests; `bun run build` completed successfully.

Coverage: `bun test --coverage` reported 88.40% lines and 76.59% functions across the existing frontend suite. The function percentage remains below the 80% target because the project uses static server rendering tests for many stateful page components; the new account payload helper is 100% covered and the dialog render paths are covered at 83.08% lines.

## Production report export filter regression

| Guarantee | Test | Result |
|---|---|---|
| Excel export keeps the selected production order alongside the date range. | `src/frontend/src/features/reports/ReportPage.test.js` | PASS, 7 tests |

RED evidence: the new regression test expected `orderId` in the export URL but the existing implementation exported only `fromDate` and `untilDate`.

GREEN evidence: the selected order ID is now passed to `/api/reports/production/export.xlsx`; the full frontend suite passed 252 tests and the production build completed successfully.
