# Today date highlighting and navigation — TDD evidence

## User journeys

- As a manager entering attendance, I want the current day to be visually distinct and the current week to open automatically.
- As a manager entering production, I want the current day column to be visually distinct and the monthly matrix to scroll to it when the selected month is current.

## TDD checkpoints

- RED: the new model/component tests failed because there was no today-block helper or today styling/scroll behavior.
- `9ccbf89` — added regression tests for current-week selection, attendance header styling, and production-matrix today behavior.
- GREEN: `49198c2` selects the attendance block containing today, highlights today with `aria-current="date"`, and jumps the production matrix to today's column.

## Guarantees

| Guarantee | Evidence | Result |
|---|---|---|
| Current attendance month opens at the 7-day block containing today | `attendanceModel.test.js` | PASS |
| Other attendance months still open at their first block | `attendanceModel.test.js` | PASS |
| Today's attendance header has dedicated styling and `aria-current` | `AttendancePage.test.js` | PASS |
| Today's production column has dedicated styling | `ProductionMonthlyMatrix.render.test.js` | PASS |
| Current production month attempts to scroll to today's header column | `ProductionMonthlyMatrix.render.test.js` and component layout effect | PASS |

## Verification

```text
bun test
201 pass, 0 fail, 589 expect() calls

bun run build
production build passed
```

When viewing a non-current month, attendance opens at day 1 and production retains the normal saved horizontal position rather than jumping to a date outside the selected month.
