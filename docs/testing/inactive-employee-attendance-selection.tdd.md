# Inactive employee attendance selection — TDD evidence

## User journey

- Manager/Admin can still view historical attendance for an inactive employee, but an inactive employee is not offered in the attendance selector and cannot create a new attendance day.

## RED

Added API and frontend regression tests in commit `38f01ed`:

- The API test failed because monthly attendance employees did not expose `isActive`.
- The frontend test failed because the active-employee selector helper did not exist.

## GREEN

Implemented in commit `1067577`:

- Attendance monthly DTOs now expose `isActive`.
- The selector filters out inactive employees while keeping legacy records without the field active by default.
- Existing backend behavior remains: historical inactive days can be edited, but new days are rejected.
- The UI explains that inactive employees cannot be selected for new attendance entry.

## Verification

```text
bun test
dotnet test German.sln --configuration Release --no-restore
bun run build
dotnet build German.sln --configuration Release --no-restore
```

- Frontend: 193 tests, 0 failures, 564 assertions.
- Backend: 9 Domain + 89 Application + 17 Infrastructure + 57 API tests passed.
- Frontend production build passed.
- Release build passed with 0 warnings and 0 errors.
