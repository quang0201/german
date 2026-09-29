---
name: dashboard-designer
description: Design and refine data-dense dashboards, ERP/admin screens, reports, tables, filters, KPI views, operational workspaces, and monitoring interfaces. Use when users need scanability, controlled density, comparison, filtering, bulk actions, tables, status, or high-frequency workflows rather than marketing-style layouts.
---


# Dashboard Designer

Operational UI is judged by speed, scanability, predictability, and error resistance.

## Start with decisions, not KPI cards

Ask:
- What decisions does the user make here?
- What anomalies deserve attention?
- What is compared over time or across entities?
- Which actions repeat many times per day?
- Which data must remain visible while scrolling?

Do not default to four oversized KPI cards at the top of every dashboard.

## Information architecture

Use a layered hierarchy:
1. page identity and critical status;
2. controls/filter context;
3. decision-driving summary;
4. primary table/chart/work area;
5. secondary detail.

Keep filters close to the data they affect.
Show active filter state clearly.
Persist meaningful filters in URL or saved view when the app supports it.

## Tables

- Align numbers for comparison.
- Use tabular numerals.
- Keep units explicit.
- Use sticky headers when long tables justify it.
- Keep row actions consistent and discoverable.
- Avoid horizontal scrolling when a responsive reflow or column priority model is better.
- When horizontal scrolling is unavoidable, preserve row identity and important columns.
- Support empty, loading, partial, and error states.
- Do not center dense table data by default.

## Charts

Use a chart only when shape, trend, distribution, composition, or comparison is easier to understand visually than in a table.

No decorative charts.
Label units and time range.
Use color semantically and sparingly.
Do not rely on color alone to encode critical meaning.

## Density

Controlled density is good.
Reduce unnecessary vertical padding before shrinking type below readable sizes.
Distinguish:
- scanning zones;
- editing zones;
- alert zones;
- drill-down detail.

Read `references/data-dense-patterns.md`.
