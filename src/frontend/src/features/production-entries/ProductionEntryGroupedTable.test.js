import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { groupProductionEntriesByDate, ProductionEntryGroupedTable } from "./ProductionEntryGroupedTable.jsx";

const columns = [
  { key: "workDate", label: "Ngày" },
  { key: "employeeCode", label: "Mã NV" },
];

const rows = [
  { id: "entry-1", workDate: "2026-08-13", employeeCode: "E002" },
  { id: "entry-2", workDate: "2026-08-12", employeeCode: "E001" },
  { id: "entry-3", workDate: "2026-08-12", employeeCode: "E003" },
];

describe("ProductionEntryGroupedTable", () => {
  test("keeps backend row and group order without client-side sorting", () => {
    expect(groupProductionEntriesByDate(rows)).toEqual([
      { workDate: "2026-08-13", rows: [rows[0]] },
      { workDate: "2026-08-12", rows: [rows[1], rows[2]] },
    ]);
  });

  test("does not render a group row for a single-day result", () => {
    const html = renderToStaticMarkup(React.createElement(ProductionEntryGroupedTable, {
      columns,
      rows: rows.slice(0, 1),
      multiDay: false,
    }));

    expect(html).not.toContain("erp-production-date-group");
    expect(html).toContain(">2026-08-13<");
  });

  test("renders semantic date groups and preserves accessible dates for multi-day rows", () => {
    const html = renderToStaticMarkup(React.createElement(ProductionEntryGroupedTable, {
      columns,
      rows,
      multiDay: true,
      onRowClick: () => {},
    }));

    expect((html.match(/<tbody/g) || []).length).toBe(2);
    expect(html).toContain("13/08/2026");
    expect(html).toContain("12/08/2026");
    expect(html).toContain("1 bản ghi");
    expect(html).toContain("2 bản ghi");
    expect(html).toContain('class="sr-only">13/08/2026</span>');
    expect(html).toContain('class=" is-clickable"');
    expect(html).toContain('tabindex="0"');
  });
});
