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

Phase 2 optimizes the day axis without changing attendance semantics. The current full-month response still materializes 28-31 days for each employee in every employee batch. The target is to load 10 calendar days initially and fetch later fixed day blocks only when horizontal scrolling requires them.

## Goals

1. Initial attendance load is bounded to 20 employees x 10 days.
2. Employee loading remains keyset-paginated at 20 employees per batch.
3. Day loading uses fixed blocks: 1-10, 11-20, 21-end-of-month. The last block is 8-11 days depending on month length.
4. Backend queries only the requested employee batch and requested day window when building day DTOs.
5. Monthly totals remain correct for the entire month even when only one day block is loaded.
6. Dirty drafts survive vertical/horizontal loading, save responses, and revisiting cached blocks.
7. Duplicate requests for the same employee/day block are deduplicated.
8. Stale requests from a previous month or obsolete block generation cannot mutate current state.
9. Cached data may grow to the full month, while rendered day columns stay bounded to at most two adjacent blocks.
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

The employee axis is loaded in keyset batches of 20. The day axis is loaded in fixed calendar blocks. Conceptually, the month is a grid of rectangles:

```text
                    DAYS
             1-10    11-20    21-end
EMP 1-20       A        B         C
EMP 21-40      D        E         F
EMP 41-60      G        H         I
```

Each rectangle is independently loadable and cacheable. A block request is identified by month, employee batch identity, and `dayFrom`.

This approach is preferred over a moving 10-day window because attendance is an editable form: loaded data and unsaved drafts must not disappear merely because the user scrolls away. It is preferred over rendering all 31 days with client-only virtualization because database query and network payload costs also need to shrink.

## Fixed day-block contract

The frontend derives the day blocks from the selected month:

```text
Block 1: day 1  -> day 10
Block 2: day 11 -> day 20
Block 3: day 21 -> last day of month
```

Therefore the third block length is:

- February non-leap: 8 days;
- February leap: 9 days;
- 30-day month: 10 days;
- 31-day month: 11 days.

There is never a fourth day block.

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

Defaults for the initial interactive request:

- `employeeLimit = 20`
- `dayFrom = 1`
- `dayCount = 10`

For later blocks, the frontend sends the exact fixed-block length. Example for August:

```http
GET /api/attendance/monthly?year=2026&month=8&dayFrom=21&dayCount=11
```

Validation:

- employee limit remains 1-100 for interactive pagination;
- `dayFrom` must be a valid day in the requested month;
- `dayCount` must be 1-11;
- `dayFrom + dayCount - 1` must not exceed the last day of the requested month;
- interactive frontend requests use only fixed block starts 1, 11, or 21.

The backend accepts any valid bounded window so the service remains testable and reusable; the UI is responsible for the fixed 1-10 / 11-20 / 21-end policy.

The response shape keeps employee pagination metadata and adds explicit day-window metadata:

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

Retain the Phase 1 opaque keyset cursor based on `(EmployeeCode, EmployeeId)`. Offset pagination is not reintroduced.

### Horizontal requests for existing employee batches

The frontend retains the input cursor/batch descriptor that produced each employee batch. To load another day block for that batch, it requests the same employee batch descriptor with a different day window.

Results are normalized and merged by `EmployeeId`, so a repeated response cannot duplicate a rendered employee. If employee ordering changes during an open session, the next full month reload is authoritative; Phase 2 does not attempt to hold a transactionally frozen employee roster across the entire interactive session.

## Backend query plan

For an interactive GET:

1. Validate month, employee pagination parameters, and day window.
2. Resolve the employee page using the existing keyset query.
3. Define:
   - month range: `monthFrom..monthUntil`;
   - requested day range: `windowFrom..windowUntil`.
4. Load saved `AttendanceDay` plus shifts only for selected employee IDs and `windowFrom..windowUntil`.
5. Load employee shift assignments only for selected employee IDs intersecting `windowFrom..windowUntil`.
6. Load required shift periods for those assignments.
7. Build day DTOs only for `windowFrom..windowUntil`.
8. Calculate full-month persisted totals for the selected employees with database-side aggregates covering `monthFrom..monthUntil`, without materializing the other day DTOs.

The application must not load all 31 attendance day entities and slice them in memory.

### Historical employee inclusion

Keep the existing database-side `EXISTS` predicate:

```text
employee is active
OR
attendance exists for employee within requested month
```

The day window must not narrow historical employee eligibility. An inactive employee with attendance on day 25 must still be eligible when requesting day block 1-10.

### Monthly totals

`AttendanceEmployeeMonthDto.Totals` continues to represent the complete persisted month.

Totals are independent of the loaded day window:

- `RegularWorkedHours`: sum saved shift entries where `ValueKind = Hours`;
- `OvertimeHours`: sum saved daily overtime;
- `PaidLeaveHours`: sum scheduled hours for saved `PaidLeave` shift entries;
- `SickLeaveHours`: sum scheduled hours for saved `SickLeave` shift entries.

The aggregate query is scoped to the selected employee IDs and the full requested month. It must not require construction of the other 18-21 projected day DTOs.

## Save contract

PUT remains dirty-day based. The frontend sends only `dirtyDayKeys`, independent of which block is currently rendered.

Phase 2 should use a save-specific response instead of rebuilding an interactive paged monthly response. Conceptual response:

```json
{
  "year": 2026,
  "month": 8,
  "employees": [
    {
      "employeeId": "...",
      "totals": {
        "regularWorkedHours": 0,
        "overtimeHours": 0,
        "paidLeaveHours": 0,
        "sickLeaveHours": 0
      },
      "days": []
    }
  ]
}
```

For each submitted employee, `days` contains only submitted/saved days required to patch the cache, while `totals` is the fresh full-month persisted total.

The save response must not reset:

- employee cursor/batch state;
- loaded day-block state;
- unrelated cached employees;
- unrelated drafts.

The save path must continue to support more than 100 submitted employees because the 100 limit applies only to interactive GET pagination.

## Frontend state model

Replace the monolithic growing `data.employees[].days[]` model for interactive cache management with normalized state.

Conceptual shape:

```js
employeeBatches = [
  {
    id: "batch-0",
    inputCursor: null,
    nextCursor: "...",
    employeeIds: ["e1", "e2", "..."],
  },
]

employeesById = {
  e1: {
    employeeId: "e1",
    employeeCode: "A001",
    fullName: "...",
    persistedTotals: { ... }
  }
}

dayBlocksByEmployee = {
  e1: {
    1:  [/* days 1-10 */],
    11: [/* days 11-20 */]
  }
}

blockStatus = {
  "generation|batch-0|1": "loaded",
  "generation|batch-0|11": "loading"
}

drafts = {
  "e1|2026-08-03": { ... }
}
```

The exact implementation may use Maps or plain objects, but these responsibilities remain separate:

- employee identity/order;
- employee batch descriptors;
- day-block cache;
- per-block request status;
- drafts;
- dirty keys;
- persisted monthly totals.

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

Before starting a request, the loader checks block state. A `loading` or `loaded` block is not requested again.

A failed block becomes `error` and exposes a retry action. Retrying transitions it to `loading` using the same block identity.

## Vertical loading

Initial state:

```text
employees 1-20 + days 1-10
```

When the user scrolls within approximately 400 px of the bottom:

1. resolve the next employee keyset batch;
2. request only the currently active day block for that new employee batch;
3. append employee identities/order;
4. normalize returned day data into cache;
5. preserve existing drafts and horizontal scroll position.

Adjacent day blocks for the new employee batch remain unloaded until required. This prevents vertical scrolling while viewing days 11-20 from automatically fetching days 1-10 and 21-end for every newly discovered employee.

## Horizontal loading

When horizontal scrolling approaches the right edge of the currently active block (target threshold approximately 300 px):

1. identify the next fixed block;
2. for employee batches intersecting the currently rendered vertical region, schedule the matching next block when its state is `idle` or `error` after explicit retry;
3. do not start duplicate requests for `loading`/`loaded` blocks;
4. activate the new columns as data becomes available;
5. keep prior blocks cached.

When scrolling left into an already cached block, no network request occurs. When a visible employee batch is missing that block, the scheduler fetches only that missing rectangle.

## Render-window bounding

Caching and rendering are separate concerns.

Although cache can eventually contain all three day blocks, the table renders at most two adjacent blocks at a time:

```text
current block + one adjacent block in the navigation direction
```

Maximum rendered calendar-day columns are therefore:

- 20 for two 10-day blocks;
- 21 when one block is August-style day 21-31.

The non-rendered cached block is represented by a fixed-width horizontal spacer so scroll geometry stays stable. When scroll direction changes and the user approaches that spacer, the render window swaps the distant block back into real columns.

Important rules:

- virtualization removes only DOM columns, never cached data;
- drafts are not owned by rendered columns;
- an unloaded adjacent block may remain a spacer/loading region until requested;
- loading a new employee batch does not force all cached day blocks to be fetched for those employees;
- a missing rectangle for a visible employee batch renders local loading placeholders rather than resetting the whole matrix.

This keeps initial and steady-state DOM materially below a fully rendered 31-day matrix while preserving continuous horizontal navigation.

## Draft behavior

Drafts remain keyed by stable employee/date identity:

```text
EmployeeId|YYYY-MM-DD
```

They are not nested under block cache entries.

Consequences:

- loading/retrying a block cannot overwrite a dirty draft;
- virtualizing a block out of DOM cannot lose a draft;
- returning to the block renders the draft value first;
- save payload construction is based on dirty keys, not rendered cells;
- save success patches only saved days and removes only successfully saved dirty keys.

When server data arrives for a day with an existing dirty draft, the draft remains authoritative for input display until that dirty value is successfully saved or the month is explicitly reloaded.

## Monthly totals with dirty drafts

Each employee stores persisted full-month totals from the backend.

Display totals are:

```text
displayTotal = persistedMonthlyTotal + dirtyDelta
```

`dirtyDelta` is computed only for dirty days, all of which must have been loaded before they could become editable.

For a dirty existing attendance day:

```text
delta = draft contribution - persisted cached day contribution
```

For a new unsaved projected day:

```text
delta = draft contribution
```

After successful save:

1. backend fresh monthly totals replace the employee's persisted totals;
2. returned saved days patch their cache rectangles;
3. only successfully saved dirty keys are removed;
4. the display delta is recomputed from any remaining dirty keys.

This keeps totals full-month accurate while still reflecting unsaved edits immediately.

## Request generation and stale-response protection

The Phase 1 month generation guard remains the outer invalidation mechanism.

Every async load/save captures:

- requested month key;
- month generation;
- for block loads, employee batch ID and `dayFrom`.

A response may mutate state only when:

1. month key still matches;
2. generation still matches;
3. for block loads, the request still corresponds to the same block key.

Changing month increments generation and resets the new month's interactive cache. Responses from the previous generation must not:

- append employees;
- append day data;
- overwrite drafts;
- clear dirty keys;
- update block error/loading state;
- update saving/loading-more state.

## Error handling

Initial-load failure remains page-level.

A later block-load failure is local to the rectangle:

- loaded blocks remain usable;
- dirty drafts remain editable/saveable;
- failed cells/block region shows a retry affordance;
- no global cache reset occurs.

Save failure remains page-level because it concerns authored changes. Dirty data remains intact.

Malformed day-window parameters return a stable 400 error envelope analogous to invalid month/employee pagination errors.

## Employee filter behavior

The current selector contains only employees already loaded into attendance cache. Phase 2 does not broaden that feature. Filtering continues to operate over loaded employees unless a separate searchable employee lookup is introduced later.

Filtering must not mutate underlying batch descriptors, cursor chain, block cache, or drafts.

## Performance expectations

For a typical employee with three regular shift rows plus one TC row:

Phase 1 initial render:

```text
20 employees x 4 rows x 31 days ~= 2,480 editable cells
```

Phase 2 initial render:

```text
20 employees x 4 rows x 10 days ~= 800 editable cells
```

This is approximately a 68% reduction in initial day-cell count, plus a comparable reduction in initial projected day DTO construction/payload.

With render-window bounding, horizontal exploration keeps at most roughly 20-21 day columns in DOM instead of all 31.

The design optimizes three layers:

- database: query requested rectangles only;
- network/cache: fetch requested rectangles only;
- DOM: render a bounded two-block window.

## Testing strategy

### Application/backend tests

Add regression coverage for:

1. default GET returns days 1-10 and `nextDayFrom = 11`;
2. `dayFrom=11&dayCount=10` returns only days 11-20;
3. final fixed block works for 28-, 29-, 30-, and 31-day months, including 11-day August-style block;
4. invalid `dayFrom`/`dayCount` returns stable error envelopes;
5. employee keyset pagination still works with day windows;
6. inactive employees with saved attendance outside the requested block remain eligible;
7. monthly totals include saved attendance outside the requested block;
8. schedule projection only covers the requested window;
9. save response contains only submitted days plus fresh monthly totals;
10. save response supports more than 100 submitted employees.

Where practical, add a PostgreSQL-backed relational query test for the keyset + `EXISTS` + day-window query shape. Existing in-memory tests do not verify Npgsql translation or SQL performance characteristics.

### Frontend model tests

Cover:

1. fixed block boundaries for all month lengths;
2. block-key generation;
3. normalization/merge without losing prior blocks;
4. request dedupe for loading/loaded blocks;
5. retry transition from error;
6. dirty draft wins over newly loaded server value;
7. dirty monthly-total delta calculations;
8. save patch removes only successfully saved dirty keys;
9. stale generation rejects load/save mutations.

### Component tests

Cover:

1. initial matrix renders only days 1-10;
2. horizontal threshold requests 11-20;
3. 31-day month requests 21-31 as an 11-day final block;
4. vertical threshold requests the next 20-employee batch for the active block;
5. cached horizontal block does not refetch;
6. block error renders retry without replacing the whole matrix;
7. horizontal scroll position survives block append/save;
8. virtualized-away block restores draft values when rendered again;
9. no more than two adjacent day blocks render simultaneously.

### CI verification

Before merge, require fresh CI on the final PR HEAD:

- backend build/tests;
- frontend tests;
- frontend production build;
- Docker/deployment checks;
- `git diff --check` where applicable.

## Implementation boundaries

Expected changes are centered on:

- `AttendanceMonthlyQuery` and monthly result DTOs;
- a save-specific attendance response DTO;
- `AttendanceService.GetMonthAsync` day-window query and monthly aggregate totals;
- `AttendanceService.SaveMonthAsync` focused save response;
- attendance API query validation;
- attendance frontend block/cache model helpers;
- `AttendancePage` block scheduler/cache orchestration;
- `AttendanceMonthlyMatrix` two-block rendering, spacers, thresholds, and local block errors;
- focused backend/frontend regression tests.

Avoid unrelated production-entry, report, export, or global UI refactors.

## Rollout sequence

Implementation should proceed in this order:

1. backend day-window contract and failing tests;
2. backend monthly aggregate totals and failing tests;
3. save-specific response and regression tests;
4. frontend fixed-block/cache pure helpers and tests;
5. first 10-day initial load;
6. horizontal block loading and request dedupe;
7. vertical batch loading against the active block;
8. two-block render window and spacers;
9. dirty-total overlay and save patching;
10. local block error/retry and stale-request regression coverage;
11. relational provider verification where feasible;
12. full CI and final PR review.

## Acceptance criteria

Phase 2 is complete when:

- opening a month fetches at most 20 employees and days 1-10;
- scrolling down loads employees in additional batches of 20;
- scrolling right loads 11-20 and then 21-end only when needed;
- August-style final block correctly loads 21-31;
- revisiting a cached block does not refetch it;
- backend does not materialize full-month day DTOs for a 10-day request;
- monthly totals remain full-month totals at all times;
- dirty drafts survive all block loads and render-window swaps;
- save submits only dirty days and patches only affected cache/totals;
- stale month/block requests cannot mutate current state;
- block-level failures are retryable without resetting loaded data;
- no more than two adjacent day blocks are rendered simultaneously;
- final CI is green on the final PR HEAD.
