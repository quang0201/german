# Production Monthly Matrix TDD Evidence

Date: 2026-08-14
Branch: `feat/production-monthly-matrix`

This file records only CI evidence observed while implementing the approved monthly production matrix plan.

## Monthly matrix query

- RED: application contract/behavior tests were added before the full matrix implementation. CI exposed a wrong test expectation for the operation subtotal; the expectation was corrected from 300 to the seeded value 280.
- GREEN: workflow run `31725603173` completed successfully after the monthly matrix query and grouping logic were implemented.

## Monthly matrix API

- RED: workflow run `31725697325` exercised the new API contract before the route was complete.
- GREEN: workflow run `31725836948` completed successfully after `GET /api/production-entries/monthly-matrix` and Manager/Admin authorization were wired.

## Atomic batch Direct entry

- GREEN application checkpoint: workflow run `31726346934` completed successfully with authorization, conflict atomicity, and multi-operation creation tests.
- Architecture regression caught by CI: workflow run `31726986134` failed because an endpoint temporarily referenced `IGermanDbContext`, violating the endpoint/application boundary.
- Fix: the batch application service was registered in composition and injected into the endpoint; the endpoint no longer references persistence abstractions.

## Frontend month helpers and matrix

- RED helper checkpoint: workflow run `31727894433` failed as expected while the helper test referenced the not-yet-created `productionMonthlyMatrix.js` module.
- GREEN matrix render checkpoint: workflow run `31728605025` completed successfully after month helpers, matrix rendering, sticky layout, order blocks, and render tests were implemented.

## Empty-month entry regression

Review found that an empty month previously hid the table header, which would make header-click batch entry impossible before the first record existed.

- Fix commit: `477e18b1eb1a545d9b17a84cb2eea369d7a503dc` always renders the calendar header when the month is empty and shows an instructional empty row.
- Exact-head verification: workflow run `31728891870` completed successfully.
  - frontend: tests + production build succeeded;
  - backend: Release build + Domain/Application/Infrastructure/API tests succeeded;
  - docker: deployment helper, Compose validation, and production image build succeeded.

## Preserved boundaries

Observed CI confirms the repository architecture tests pass at the exact-head verification above. No database migration or third-party dependency was added, and `ProductionCalculator` was not modified.
