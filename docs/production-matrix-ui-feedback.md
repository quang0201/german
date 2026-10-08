# Production matrix UI feedback

This note records the operator's repeated feedback as durable product/design requirements for future production-matrix changes. Treat these as acceptance criteria, not one-off visual preferences.

## Recorded requirements

- Keep the matrix compact and responsive so its columns fit the viewport sensibly; avoid oversized controls, excess whitespace, and rounded/pill styling.
- Make row and column boundaries easy to track, with consistent grid lines and clear employee grouping.
- Keep ordinary data cells neutral. Do not alternate unexplained green and white fills; reserve color for a defined state such as missing attendance, paid leave, warning, or a focused/hovered cell.
- Keep the meaning of each color consistent and explain non-obvious status colors with a small nearby legend. Never use color alone to communicate status.
- Show the useful daily total by default; let the user click it to inspect HC and TC rather than repeating both values everywhere.
- Remove labels and headings that repeat information already visible elsewhere (for example, a redundant “+ Nhập” in every date header, or duplicated production-code titles).
- Make the date header itself the click target for quick entry. Keep a clear keyboard focus indication and an accessible action name, without requiring a permanently visible “+ Nhập” label.
- Keep hover feedback subtle and useful for locating the current row/column; it must not recolor normal cells as if their data state changed.
- Keep employee names readable within a modest fixed column: wrap at word boundaries when practical and truncate exceptionally long names rather than expanding the matrix.
- Review the actual rendered application with real data at desktop and mobile widths before calling a UI change complete. A static mockup is not an adequate final review.

## Provenance

Consolidated from operator feedback during production-matrix UI reviews and follow-up requests on 2026-09-29. Update this note when the operator gives new, conflicting direction; do not silently discard earlier constraints.
