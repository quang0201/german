# Employee shift reassignment UI — TDD evidence

## User journey

- A Manager/Admin can open an employee's edit popup, choose a new active HC shift and effective date, and assign it without losing the employee profile or historical shift configuration.

## TDD checkpoints

- RED: the new dialog and page tests failed because the edit popup had no shift assignment section or assignment request.
- `cf59892` — added regression tests for the popup UX, assignment payload, and page API wiring.
- GREEN: `9dc33dc` adds the shift assignment section, validation, loading/error feedback, and calls the existing `POST /api/employees/{id}/shift-assignments` endpoint.
- Review follow-up: `a980c0a` adds application/API regression tests for inactive employees; `a7197a5` loads the employee before assignment and rejects inactive records with `employee.inactive`.

## UX behavior

- Profile editing remains a separate `PUT /api/employees/{id}` action.
- Shift adjustment is explicitly labeled “Điều chỉnh bộ ca”.
- The new shift is applied from a required effective date; old assignment history remains intact.
- Inactive employees cannot receive a new assignment from the popup.
- Assignment errors remain visible inside the popup.
- Opening another employee clears the previous assignment error.

## Verification

```text
bun test
dotnet test German.sln --configuration Release --no-restore
bun run build
dotnet build German.sln --configuration Release --no-restore
```

- Frontend: 196 tests, 0 failures, 572 assertions.
- Backend: 9 Domain + 90 Application + 17 Infrastructure + 58 API tests passed.
- Frontend production build passed.
- Release build passed with 0 warnings and 0 errors.
