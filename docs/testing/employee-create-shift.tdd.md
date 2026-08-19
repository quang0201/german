# Employee creation with shift assignment

## User journey

As a Manager/Admin, I can open a popup to create an employee, choose an active HC shift template and an effective date, so the employee is ready for attendance entry immediately.

## TDD evidence

- RED checkpoint: `4ea943f` — frontend helper and backend service tests failed because the create-with-shift contract did not exist.
- GREEN checkpoint: `724ac54` — the atomic create contract, popup, shift loading and assignment validation were implemented.
- Follow-up guardrail: the frontend runtime safety test was updated to require the create popup instead of the removed inline form.
- Review follow-up: backend creation now rejects a missing shift assignment, API coverage includes complete/missing/inactive-shift requests, and employee loading is independent from shift-template loading.
- Delete follow-up: employee deletion is exposed as a soft-delete action so attendance, production and account history remain intact.
- Review follow-up: inactive employees can only edit existing attendance snapshots; new attendance days are rejected and unsaved inactive cells have no editable shift slots.
- Review follow-up: authenticated cookies revalidate the account, linked employee and role on each authenticated request, so an existing session is rejected after employee deactivation.

## Verification

| Guarantee | Test | Result |
|---|---|---|
| Create form initializes an effective date and empty shift selection | `employeeCreate.test.js` | PASS |
| Create payload trims employee fields and includes shift assignment | `employeeCreate.test.js` | PASS |
| Create popup displays active shift and effective date controls | `EmployeeDialog.test.js` | PASS |
| Employee page uses a popup instead of inline creation fields | `EmployeeListPage.test.js` and `runtimeSafety.test.js` | PASS |
| Backend persists employee and assignment together | `EmployeeServiceTests.CreateAsyncWithShiftCreatesEmployeeAndEffectiveAssignment` | PASS |
| Invalid shift is rejected before employee creation | `EmployeeServiceTests.CreateAsyncRejectsMissingShiftBeforeCreatingEmployee` | PASS |
| API creates employee + assignment and rejects missing/inactive shifts | `ManagerAdministrationApiTests` employee-create tests | PASS |
| Employee list remains loadable when shift-template loading fails | `EmployeeListPage.test.js` source guardrail | PASS |
| Employee delete deactivates without removing the employee record | `EmployeeServiceTests.DeleteAsyncDeactivatesEmployeeAndKeepsHistory`, `ManagerAdministrationApiTests.Manager_CanDeleteEmployeeWithoutDeletingTheEmployeeRecord` | PASS |
| Employee delete uses the shared confirmation dialog and API endpoint | `EmployeeListPage.test.js` | PASS |
| Inactive attendance history remains editable while new days are rejected | `AttendanceServiceTests` inactive employee regression tests | PASS |
| Existing session is rejected after linked employee deactivation | `ManagerAdministrationApiTests.DeletingEmployeeRejectsAnAlreadyIssuedWorkerSession` | PASS |
| Unknown employee deletion returns HTTP 404 | `ManagerAdministrationApiTests.Manager_DeleteUnknownEmployeeReturnsNotFound` | PASS |
| Employee-related account, attendance and production records remain after delete | `ManagerAdministrationApiTests.Manager_CanDeleteEmployeeWithoutDeletingTheEmployeeRecord` | PASS |

Commands run:

- `bun test` — 172 pass, 0 fail, 509 assertions.
- `bun run build` — production build passed.
- `dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-restore` — 82 pass.
- `dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --no-restore` — 9 pass.
- `dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-restore` — 17 pass.
- `dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-restore` — 53 pass.
