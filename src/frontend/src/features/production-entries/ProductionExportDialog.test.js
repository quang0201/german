import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionExportDialog } from "./ProductionExportDialog.jsx";

describe("ProductionExportDialog", () => {
  test("offers independent export presets and 366-day custom range", () => {
    const html = renderToStaticMarkup(React.createElement(ProductionExportDialog, {
      open: true,
      initialMode: "custom",
      initialAnchorDate: "2026-01-01",
      initialFromDate: "2026-01-01",
      initialUntilDate: "2026-02-01",
    }));

    expect(html).toContain("Ngày");
    expect(html).toContain("Tuần");
    expect(html).toContain("Tháng");
    expect(html).toContain("Tùy chọn");
    expect(html).toContain('aria-label="Khoảng ngày export"');
    expect(html).toContain('value="2026-01-01"');
    expect(html).toContain('value="2026-02-01"');
    expect(html).toContain("Tối đa 366 ngày");
  });

  test("does not render when closed", () => {
    const html = renderToStaticMarkup(React.createElement(ProductionExportDialog, { open: false }));
    expect(html).toBe("");
  });
});
