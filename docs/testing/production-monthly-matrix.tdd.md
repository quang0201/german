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
- Validation RED: workflow run `31766779117` failed the two new server-side cases for non-`InProduction` orders and inactive operations. Both cases passed after validation was added before staging writes.
- API null-safety RED: workflow run `31767196507` failed `BatchDirect_ExplicitNullItemsMapsEmptyBatchInsteadOf500` with `ArgumentNullException` at the endpoint mapping. The API boundary now normalizes explicit `items: null` to an empty batch so Application returns `production_entry.batch_empty` instead of a 500.

## Frontend month helpers and matrix

- RED helper checkpoint: workflow run `31727894433` failed as expected while the helper test referenced the not-yet-created `productionMonthlyMatrix.js` module.
- GREEN matrix render checkpoint: workflow run `31728605025` completed successfully after month helpers, matrix rendering, sticky layout, order blocks, and render tests were implemented.
- Test-discovery regression: the original render test differed from the helper test only by filename case. Workflow run `31766983246` ran the uniquely named render suite and exposed both the false `rowspan` assertion and the real single-order selector issue. The assertion was corrected to React server markup and the sole Mã SX remains selectable so operation filtering can be enabled.
- Active-employee RED: workflow run `31767161896` failed because the batch dialog did not yet select the first active employee. The helper now skips inactive employees and the dropdown already filters them.
- Localization RED: workflow run `31767323360` failed after adding coverage requiring Vietnamese entry-mode labels in the multiple-record chooser. The chooser now uses the shared `entryModeLabel` mapping.
- Responsive RED: workflow run `31767563172` failed the new narrow-screen contract because all three total columns remained sticky-right together with both sticky-left columns. At `<= 900px`, total columns now scroll normally while the two left identity columns remain sticky.
- Visual-token RED: workflow run `31767871350` failed after adding a feature CSS guard against local hex/RGB literals. Matrix styles now use the existing ERP border, primary-soft, focus-ring and text tokens instead of feature-local color literals.

## Empty-month entry regression

Review found that an empty month previously hid the table header, which would make header-click batch entry impossible before the first record existed.

- Fix commit: `477e18b1eb1a545d9b17a84cb2eea369d7a503dc` always renders the calendar header when the month is empty and shows an instructional empty row.
- Exact-head verification at that checkpoint: workflow run `31728891870` completed successfully.

## Final code-head verification

Workflow run `31767903229` verified code head `4bdb9e3f8ad0e3c7772d60a35d18348248429624` after the final review fixes, including batch null-safety, localized aggregate-record choices, active employee defaulting, narrow-screen sticky behavior, success feedback, quick-edit conflict reload, and ERP color-token compliance.

- Frontend: `103` passed, `0` failed across `31` files with `326` expectations; production build succeeded and bundled `67` modules.
- Backend Release build: succeeded with `0` warnings and `0` errors.
- Domain tests: `9` passed, `0` failed.
- Application tests: `53` passed, `0` failed.
- Infrastructure tests: `8` passed, `0` failed.
- API tests: `39` passed, `0` failed.
- Docker job: deployment helper, Compose validation, and production image build all succeeded.

## Cumulative review findings

Review of `dev...feat/production-monthly-matrix` found and fixed the following before PR:

- restored the HTTP/Application architecture boundary after CI detected a temporary persistence dependency in the endpoint;
- added server-side order-status and operation-active validation for batch writes;
- normalized explicit null batch items at the API boundary;
- made the sole production order selectable so the existing operation filter remains usable;
- restored shared production-entry version-conflict messaging and an explicit matrix reload action;
- localized entry modes in aggregate-cell record selection;
- removed excessive sticky-right columns on narrow screens while preserving horizontal matrix scrolling;
- kept new matrix/dialog colors on the shared ERP token system;
- added role-dispatch coverage proving Worker remains on the existing period/list flow while Manager/Admin use the monthly matrix.

No database migration or third-party dependency was added. The cumulative diff does not modify `ProductionCalculator` or the Excel exporter/workbook implementation. The known duplicate-key concurrency limitation remains unchanged by design: the database does not enforce a unique matrix cell key, so batch creation performs a conflict pre-check but cannot provide a database-level uniqueness guarantee without changing existing data semantics.
