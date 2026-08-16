# Attendance 2D Lazy Loading Design

Date: 2026-08-16

## Context

PR #18 already implements attendance Phase 1:

- monthly attendance entry for Manager/Admin;
- dynamic shift rows plus one daily overtime (TC) row;
- save-only-dirty-days semantics;
- 20-employee keyset pagination with vertical infinite loading;
- database-side historical employee inclusion;
- request generation guards for stale load/save responses;
- horizontal scroll position stored in a ref.

Phase 2 optimizes the day axis without changing attendance semantics. The current full-month response still materializes 28-31 days for each employee in every employee batch. The target is to load at most 10 calendar days initially and fetch later day blocks only when horizontal scrolling requires them.

## Goals

1. Initial attendance load is bounded to 20 employees x 10 days.
2. Employee loading remains keyset-paginated at 20 employees per batch.
3. Day loading uses fixed blocks: 1-10, 11-20, 21-end-of-month.
4. Backend queries only the requested employee batch and requested day window when building day DTOs.
5. Monthly totals remain correct for the entire month even when only one day block is loaded.
6. Dirty drafts survive vertical/horizontal loading, save responses, and revisiting cached blocks.
7. Duplicate requests for the same employee/day block are deduplicated.
8. Stale requests from a previous month or obsolete block generation cannot mutate current state.
9. Cached data may grow to the full month, but rendered day columns remain bounded to a small window.
10. Phase 2 does not change production-entry integration, Excel export, attendance business rules, or shift snapshot semantics.

## Non-goals

- Production entry automatically consuming attendance HC/TC.
- Attendance Excel export.
- Autosaving attendance drafts.
- Persisting unsaved drafts across month changes or page reloads.
- Changing paid leave, sick leave, overtime, or shift snapshot rules.
- Worker access.
- Replacing the current table with a general-purpose grid library.

## Chosen approach

Use two-dimensional lazy loading with normalized block caching.

The employee axis is loaded in keyset batches of 20. The day axis is loaded in fixed calendar blocks of 10. Conceptually, the month is a grid of rectangles:

```text
                    DAYS
             1-10    11-20    21-end
EMP 1-20       A        B         C
EMP 21-40      D        E         F
EMP 41-60      G        H         I
```

Each rectangle is independently loadable and cacheable. A block request is identified by month, employee batch identity, and `dayFrom`.

This approach is preferred over a moving 10-day window because attendance is an editable form: loaded data and unsaved drafts must not disappear merely because the user scrolls away. It is preferred over rendering all 31 days with client-only virtualization because server query and payload costs also need to shrink.

## API contract

Extend the existing monthly GET endpoint:

```http
GET /api/attendance/monthly
    ?year=2026
    &month=8
    &employeeCursor=...
    &employeeLimit=20
    &dayFrom=1
    &dayCount=10
```

Defaults remain suitable for interactive use:

- `employeeLimit = 20`
- `dayFrom = 1`
- `dayCount = 10`

Validation:

- employee limit remains 1-100 for interactive pagination;
- `dayFrom` must be a valid day in the requested month;
- `dayCount` must be 1-10;
- the effective `dayTo` is clamped to the last day of the month.

The response shape keeps existing employee pagination metadata and adds explicit day-window metadata:

```json
{
  "year": 2026,
  "month": 8,
  "dayFrom": 1,
  "dayTo": 10,
  "nextDayFrom": 11,
  "hasMoreDays": true,
  "employees": [],
  "employeeCursor": null,
  "employeeLimit": 20,
  "nextEmployeeCursor": "...",
  "hasMoreEmployees": true
}
```

For the final block, `nextDayFrom` is null and `hasMoreDays` is false.

### Employee cursor semantics

Retain the Phase 1 opaque keyset cursor based on `(EmployeeCode, EmployeeId)`. No offset pagination is reintroduced.

### Horizontal requests for existing employee batches

The frontend retains the cursor/batch descriptor that produced each employee batch. To load another day block for that batch, it requests the same employee batch descriptor with a different `dayFrom`.

Results are merged by `EmployeeId`, so transient employee-list changes cannot duplicate rendered employees. If an employee code changes during an open session, the next full month reload becomes the authoritative ordering boundary; Phase 2 does not attempt to maintain a transactionally frozen employee roster across the entire interactive session.

## Backend query plan

For an interactive GET:

1. Validate month, employee pagination parameters, and day window.
2. Resolve the 20-employee page using the existing keyset query.
3. Define:
   - month range: `monthFrom..monthUntil`;
   - requested day range: `windowFrom..windowUntil`.
4. Load saved `AttendanceDay` plus shifts only for selected employee IDs and `windowFrom..windowUntil`.
5. Load employee shift assignments only for selected employee IDs intersecting `windowFrom..windowUntil`.
6. Load required shift periods for the selected assignments.
7. Build day DTOs only for the requested day window.
8. Calculate monthly totals for the selected employees using database-side aggregate queries covering the full month, without materializing the other 18-21 day DTOs.

The key constraint is that the application must not load all 31 attendance day entities and then slice them in memory.

### Monthly totals

`AttendanceEmployeeMonthDto.Totals` continues to represent the complete month.

Totals are independent of the loaded day window:

- `RegularWorkedHours`: sum of saved shift entries with `ValueKind = Hours`.
- `OvertimeHours`: sum of saved daily overtime.
- `PaidLeaveHours`: sum of scheduled hours for saved `PaidLeave` shift entries.
- `SickLeaveHours`: sum of scheduled hours for saved `SickLeave` shift entries.

Unsaved projected days contribute zero until the user creates a draft. The frontend overlays dirty-draft deltas on top of the persisted monthly totals for immediate feedback.

The backend aggregate is scoped to the selected employee IDs and the full requested month. This preserves correct totals while avoiding construction of all day DTOs.

## Save contract

PUT remains dirty-day based. The frontend sends only `dirtyDayKeys`, independent of which day block is currently rendered.

After persistence, the backend response contains:

- every submitted employee;
- the saved day data required to patch those employee/day cache entries;
- fresh full-month totals for those submitted employees.

The save response must not reset employee pagination state, loaded day-block state, or unrelated cached employees.

The existing internal `EmployeeIds` save-response path may continue to bypass the interactive 100-employee limit.

## Frontend state model

Replace the monolithic growing `data.employees[].days[]` model for interactive cache management with normalized state.

Conceptual shape:

```js
employeeBatches = [
  {
    id: "batch-0",
    cursor: null,
    nextCursor: "...",
    employeeIds: ["e1", "e2", "..."],
  },
]

employeesById = {
  e1: {
    employeeId: "e1",
    employeeCode: "A001",
    fullName: "...",
    totals: { ... }
  }
}

dayBlocksByEmployee = {
  e1: {
    1:  [/* days 1-10 */],
    11: [/* days 11-20 */]
  }
}

blockStatus = {
  "2026-08|batch-0|1": "loaded",
  "2026-08|batch-0|11": "loading"
}

drafts = {
  "e1|2026-08-03": { ... }
}
```

The exact implementation may use Maps or plain objects, but these responsibilities remain separate:

- employee identity/order;
- day-block cache;
- per-block request status;
- drafts;
- dirty keys;
- monthly totals.

## Block identity and request deduplication

A block key contains:

```text
monthGeneration + employeeBatchId + dayFrom
```

Each block has one of four states:

- `idle`
- `loading`
- `loaded`
- `error`

Before starting a request, the loader checks the block state. A `loading` or `loaded` block is not requested again.

A failed block becomes `error` and exposes a retry action. Retrying transitions it back to `loading`.

## Vertical loading

Initial state:

```text
employees 1-20 + days 1-10
```

When the user scrolls within approximately 400 px of the bottom:

1. request the next employee keyset batch;
2. request only the current active 10-day block for that new employee batch;
3. append employee identities/order;
4. normalize returned day data into the cache;
5. preserve existing drafts and horizontal scroll position.

Adjacent day blocks for the new employee batch remain unloaded until required. If the rendered horizontal window later needs one, the block scheduler requests it.

## Horizontal loading

Fixed day starts are derived from the month:

```text
1, 11, 21
```

The final block ends on the actual last day of the month.

When horizontal scrolling approaches the right edge of the currently loaded block (target threshold approximately 300 px):

1. identify `nextDayFrom`;
2. for employee batches that intersect the currently rendered vertical region, schedule the matching next day block if it is not loaded/loading;
3. append/activate the new day columns when the required data arrives;
4. keep previously loaded blocks cached.

Horizontal scrolling back to an already cached block performs no network request.

## Render-window bounding

Caching and rendering are separate concerns.

The cache may eventually contain all 31 days, but the table should render at most:

```text
previous block + current block + next loaded block
```

That is normally at most 30 calendar-day columns. Blocks farther away are represented by fixed-width horizontal spacers so scroll geometry remains stable.

Important rules:

- an unloaded adjacent block may remain a spacer until it is actually requested;
- loading a new vertical employee batch does not force all cached day blocks to be fetched for those employees;
- when a missing block enters the render window for a newly loaded employee batch, its cells render as a local loading placeholder until the block request completes;
- loaded blocks are never discarded merely to reduce DOM size; only their rendered columns are virtualized away.

This avoids losing editable state while preventing the DOM from growing without bound as the user explores the month.

## Draft behavior

Drafts remain keyed by stable employee/date identity:

```text
EmployeeId|YYYY-MM-DD
```

They are not nested under block cache entries.

Consequences:

- loading or retrying a block cannot overwrite an existing dirty draft;
- horizontally virtualizing a block out of the DOM does not lose the draft;
- returning to the block renders the draft value first;
- save payload construction can scan dirty keys rather than the rendered table;
- save success patches persisted cache entries and removes only successfully saved dirty keys.

When server data for a day arrives and a dirty draft already exists, the draft remains authoritative for the input display until save/reload resolves it.

## Monthly totals with dirty drafts

Each employee stores the persisted monthly totals returned by the backend.

For display, the frontend computes:

```text
displayTotal = persistedMonthlyTotal + dirtyDelta
```

`dirtyDelta` is calculated only from dirty days whose previous persisted values are known in cache.

For a dirty existing attendance day:

```text
delta = draft contribution - persisted day contribution
```

For a new unsaved day:

```text
delta = draft contribution
```

After a successful save, the backend-provided fresh monthly totals replace the persisted totals and saved dirty deltas are removed.

This prevents totals from showing only the currently loaded 10-day block while still allowing immediate feedback during editing.

## Request generation and stale-response protection

The Phase 1 month generation guard remains the outer invalidation mechanism.

Every async load/save captures:

- requested month key;
- month generation;
- for block loads, employee batch ID and `dayFrom`.

A response may mutate state only if:

1. month key still matches;
2. generation still matches;
3. the block request identity is still current for that cache key.

Changing month increments the generation and resets the new month's interactive cache. Responses from the previous month must not:

- append employees;
- append day data;
- overwrite drafts;
- clear dirty keys;
- update error/loading state;
- update saving state.

## Error handling

Initial-load failure continues to show the page-level attendance error state.

A later block-load failure is local to that block:

- existing loaded blocks remain usable;
- dirty drafts remain editable/saveable;
- the failed block shows a retry affordance;
- no global cache reset occurs.

Save failure remains page-level because it affects user-authored changes. Dirty data remains intact.

Malformed day-window parameters return a stable 400 error envelope, analogous to existing invalid month/employee pagination errors.

## Employee filter behavior

The existing employee selector currently contains only employees already loaded into the attendance cache. Phase 2 does not broaden this feature. Filtering continues to operate over loaded employees unless a separate searchable employee lookup is introduced in a future scope.

Filtering must not mutate the underlying employee batch cache or cursor chain.

## Performance expectations

For a typical employee with three regular shift rows plus one TC row:

Current Phase 1 initial render:

```text
20 employees x 4 rows x 31 days ~= 2,480 editable cells
```

Phase 2 initial render:

```text
20 employees x 4 rows x 10 days ~= 800 editable cells
```

This is approximately a 68% reduction in initial day-cell count, in addition to reducing attendance day DTO/query payload from 31 to 10 days.

The design deliberately optimizes all three layers:

- database: query requested rectangles only;
- network/cache: fetch requested rectangles only;
- DOM: render a bounded day-block window.

## Testing strategy

### Application/backend tests

Add regression coverage for:

1. default GET returns days 1-10 and `nextDayFrom = 11`;
2. `dayFrom=11&dayCount=10` returns only days 11-20;
3. final block clamps correctly for 28-, 29-, 30-, and 31-day months;
4. invalid dayFrom/dayCount returns the expected error;
5. employee keyset pagination still works with day windows;
6. inactive employees with saved attendance remain eligible;
7. monthly totals include saved attendance outside the requested day block;
8. schedule projection only covers the requested window;
9. save response returns fresh monthly totals;
10. save response still supports more than 100 submitted employees.

Where practical, add a relational/PostgreSQL-backed query test for the keyset + EXISTS + day-window query shape. Existing in-memory tests alone do not verify provider translation or SQL performance characteristics.

### Frontend model tests

Cover:

1. block-key generation and fixed day-block boundaries;
2. normalization/merge without losing prior blocks;
3. request dedupe for loading/loaded blocks;
4. retry transition from error;
5. dirty draft wins over newly loaded server value;
6. dirty monthly-total delta calculations;
7. save patch removes only saved dirty keys;
8. stale month generation rejects load/save mutations.

### Component tests

Cover:

1. initial matrix renders only the first 10 day columns;
2. horizontal threshold requests the next day block;
3. vertical threshold requests the next 20-employee batch for the active day block;
4. cached horizontal block does not refetch;
5. block error renders retry without replacing the whole matrix;
6. horizontal scroll position survives block append/save;
7. virtualized-away day blocks restore draft values when rendered again.

### CI verification

Before merge, require fresh CI on the final PR HEAD:

- backend build/tests;
- frontend tests;
- frontend production build;
- Docker/deployment checks;
- `git diff --check` where applicable.

## Implementation boundaries

Expected files to change are centered on:

- `AttendanceMonthlyQuery` / monthly result DTOs;
- `AttendanceService.GetMonthAsync` query and totals calculation;
- attendance API parameter validation;
- attendance frontend state/model helpers;
- `AttendancePage` block scheduler/cache orchestration;
- `AttendanceMonthlyMatrix` horizontal block rendering/threshold behavior;
- focused backend/frontend regression tests.

Avoid unrelated production-entry, report, export, or global UI refactors.

## Rollout sequence

Implementation should proceed in this order:

1. backend day-window contract and tests;
2. backend monthly aggregate totals and tests;
3. frontend normalized cache/block model with pure helper tests;
4. first 10-day initial load;
5. horizontal block loading and request dedupe;
6. vertical batch loading against the active day block;
7. bounded render window/spacers;
8. dirty-total overlay and save patching;
9. stale-request/error/retry regression coverage;
10. full verification and PR review.

## Acceptance criteria

Phase 2 is complete when:

- opening a month fetches at most 20 employees and days 1-10;
- scrolling down loads employees in additional batches of 20;
- scrolling right loads 11-20 and then 21-end only when needed;
- revisiting a loaded block does not refetch it;
- monthly totals remain full-month totals at all times;
- dirty drafts survive all block loads and render-window changes;
- save submits only dirty days and updates only affected cache/totals;
- stale month/block requests cannot mutate current state;
- block-level failures are retryable without resetting loaded data;
- final CI is green on the final PR HEAD.
