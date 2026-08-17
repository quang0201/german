# Employee creation with shift assignment

## User journey

As a Manager/Admin, I can open a popup to create an employee, choose an active HC shift template and an effective date, so the employee is ready for attendance entry immediately.

## TDD evidence

- RED checkpoint: `4ea943f` — frontend helper and backend service tests failed because the create-with-shift contract did not exist.
- GREEN checkpoint: `724ac54` — the atomic create contract, popup, shift loading and assignment validation were implemented.
- Follow-up guardrail: the frontend runtime safety test was updated to require the create popup instead of the removed inline form.

## Verification

| Guarantee | Test | Result |
|---|---|---|
| Create form initializes an effective date and empty shift selection | `employeeCreate.test.js` | PASS |
| Create payload trims employee fields and includes shift assignment | `employeeCreate.test.js` | PASS |
| Create popup displays active shift and effective date controls | `EmployeeDialog.test.js` | PASS |
| Employee page uses a popup instead of inline creation fields | `EmployeeListPage.test.js` and `runtimeSafety.test.js` | PASS |
| Backend persists employee and assignment together | `EmployeeServiceTests.CreateAsyncWithShiftCreatesEmployeeAndEffectiveAssignment` | PASS |
| Invalid shift is rejected before employee creation | `EmployeeServiceTests.CreateAsyncRejectsMissingShiftBeforeCreatingEmployee` | PASS |

Commands run:

- `bun test` — 170 pass, 0 fail, 501 assertions.
- `bun run build` — production build passed.
- `dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-restore` — 78 pass.
- `dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --no-restore` — 9 pass.
- `dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-restore` — 17 pass.
- `dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-restore` — 47 pass.
