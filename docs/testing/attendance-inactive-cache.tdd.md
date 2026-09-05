# Attendance inactive employee and cache handling

## User journey

As a manager, I want the attendance table to show only employees who are currently active, while keeping historical attendance data intact, so that inactive employees do not appear as editable rows.

## TDD evidence

| Behavior | Test | Result |
|---|---|---|
| Inactive employees are excluded from the attendance entry render data | `src/frontend/src/features/attendance/attendanceModel.test.js` | PASS |
| Backend GET data requests bypass browser caches | `src/frontend/src/lib/api.test.js` | PASS |
| Attendance monthly and Excel endpoints send no-store/no-cache headers | `tests/German.Api.Tests/Attendance/AttendanceApiTests.cs` | PASS |

The RED run failed on the inactive row assertion, the missing `api.get` cache option, and the missing backend cache headers. The GREEN run passed after the minimal filtering and cache-control implementation.

Validation commands:

- `bun test src/features/attendance/attendanceModel.test.js src/lib/api.test.js` — 18 pass.
- `dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --filter FullyQualifiedName~Attendance` — 26 pass.
- `dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --filter FullyQualifiedName~Attendance` — 10 pass.
- `bun test` — 243 pass, 0 fail.

## Implementation

The backend remains the source of attendance data. Inactive employees are filtered from the attendance entry render model and employee selector, while existing history remains in the database and backend export service. Frontend GET requests and attendance monthly/export responses use `no-store` cache handling to prevent stale employee status.
