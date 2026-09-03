# Production attendance hour autofill — TDD evidence

## Contract

- A new production entry reads saved attendance for the selected employee and date.
- `regularHours` is the default `Giờ HC`; `overtimeHours` is the default `Giờ TC`.
- Both defaults remain editable before saving.
- If attendance has not been saved, both fields remain blank.
- Editing an existing production entry does not load attendance values over the existing draft.
- The submitted `HcHours` is passed to backend calculation; when present, the backend does not resolve the shift template again.
- Direct entry remains unchanged.

## TDD checkpoints

### RED — `e254c5a`

Added failing coverage for:

- attendance lookup returning saved and unsaved hour values;
- existing production edits not using attendance autofill;
- production calculation using the HC hours sent by the form;
- production form wiring the attendance lookup and `hcHours` payload.

The backend RED test initially failed because the production command did not yet accept `HcHours`; the frontend source test failed because the form still used the shift-template lookup.

### GREEN — `71ff045`

The implementation adds:

- `GET /api/lookups/attendance-hours` with Worker ownership protection;
- optional `HcHours` on create/update contracts and commands;
- backend calculation override with validation for HC hours when TC is entered;
- attendance defaults in the standard production form and matrix quick-entry popup;
- edit-mode protection so saved production edits continue using their existing edit flow.

### Review follow-up

- `ProductionEntry.HcHours` is now nullable-persisted in migration `20260820072106_PersistProductionEntryHcHours`.
- Create/update DTOs and detail responses expose the saved HC hours.
- Editing a saved record uses its persisted HC hours; legacy rows with `NULL` retain the shift-template fallback.
- `Lưu & nhập tiếp` resets HC and TC together, then reloads attendance defaults for the next entry.

## Verification

Commands run locally:

```text
bun test
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --no-restore
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-restore
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-restore
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-restore
bun run build
```

Results:

- Frontend: 179 tests, 0 failures, 525 assertions.
- Backend: 9 Domain + 84 Application + 17 Infrastructure + 55 API tests passed.
- Frontend production build passed.
