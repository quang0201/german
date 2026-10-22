# Daily production review

The manager production page defaults to a daily view; `?view=week` retains the weekly matrix. Date and existing employee/order/operation/search filters stay in the URL. Daily export initially selects the displayed day.

The daily view joins the existing production matrix with paginated attendance for that date. It displays full order codes/product names, operation names, units, total/HC/TC quantities, and attendance hours once per employee. Stored zero entries remain editable; absent entries are not presented as zeros. It never adds quantities across operations or incompatible units into a finished-product total.

Statuses describe persisted data, not approval: output and attendance present, output without attendance, attendance without output, leave, hourly attendance, or no entry. Attendance loading/errors are explicitly unknown and never reported as complete. There is no new draft storage or approval workflow in this release.

Validation:

- Frontend: 432 tests pass, including daily joins, missing attendance/output, zero records, historical/inactive employees, partial leave, and rendered identity/units/error states.
- Production frontend build passes.
- API suite: 82 tests pass. The test factory uses ephemeral Data Protection so Linux CI never writes the production `/app-keys` volume; production key persistence is unchanged.
- `bun audit`: no vulnerabilities after pinning the transitive build dependency `source-map-js` to patched 1.2.2.
- Local browser QA with synthetic read-only fixtures: 1440px desktop and 390px mobile; no document horizontal overflow at mobile width; status filters, show-empty toggle, date switching, attendance error, and weekly view verified.
- Mobile tables reflow into stacked rows; persistent employee identity and status remain visible above each table.

Deployment: frontend-only, no schema change. Deploy the committed `dev` revision using the existing `deploy.sh` workflow on the configured server; verify `/health` and `/production` after deployment. Local QA does not imply deployment or verification against production data.
