# Production batch attendance-shift allocation — TDD evidence

## User journeys

- As a Manager/Admin, I can load the selected employee's saved attendance hours before entering several operations for one day.
- I can choose direct quantities, total-hours allocation, or attendance-shift allocation.
- In attendance-shift mode, dynamic shifts and overtime remain editable and every operation reuses the same hour inputs.
- The preview allocates production to each shift, HC total, and TC total while preserving the entered total.
- Changing employee or day cannot apply an obsolete attendance response.
- The final request remains `batch-direct` and stores only direct HC/TC quantities.

## TDD checkpoints

### RED — `c018cb0`

Added API and frontend tests for the dynamic `shifts` response, stale attendance request guards, multi-shift allocation, decimal totals, and batch mode wiring. RED evidence:

- API lookup tests failed because `shifts` was absent from the response.
- Frontend tests failed because `isCurrentAttendanceRequest` and `calculateMultiShiftHourSplit` did not exist.

### GREEN — `dbf9dae`

Implemented:

- `AttendanceHoursDto.Shifts` with ordered `SlotNumber`, `ShiftName`, and `WorkedHours` values.
- Attendance lookup loading with employee/date race protection and editable hour drafts.
- Three batch modes and dynamic operation columns for attendance shifts.
- Shared multi-bucket allocation based on the existing parser and rounding helper.
- Direct batch payload conversion with `HC + TC = Total` preservation.

### Review follow-up after syncing `dev`

- Batch dialogs preserve the employee selected by the active matrix filter through `preferredEmployeeId`.
- Attendance responses apply the returned dynamic shift structure even when loading overlaps with user input.
- HC, TC, and each shift have independent dirty markers, so only untouched fields are autofilled.

## Verification

Relevant tests run:

```text
bun test src/features/production-entries/productionMatrixBatch.test.js src/features/production-entries/productionMatrixHourSplit.test.js src/features/production-entries/ProductionMatrixBatchEntryDialog.test.js
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --filter "FullyQualifiedName~AttendanceHoursLookup_ReturnsOrderedWorkedShifts|FullyQualifiedName~AuthorizedUser_ReadsEmptyAttendanceHoursWhenDayWasNotSaved" --no-restore
```

Targeted results:

- Frontend targeted batch/hour tests: 22 pass, 0 failures, 69 assertions.
- Backend targeted attendance API tests: 2 pass, 0 failures.

Full verification after implementation:

```text
bun test
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --no-restore
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-restore
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-restore
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-restore
bun run build
```

- Frontend: 192 tests, 0 failures, 563 assertions.
- Backend: 9 Domain + 89 Application + 17 Infrastructure + 57 API tests passed.
- Frontend production build passed.
- Docker remains covered by the PR CI workflow.
