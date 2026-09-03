import React from "react";
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionExportDialog } from "./ProductionExportDialog.jsx";

test("shows Sunday exclusion checked by default", () => {
  const html = renderToStaticMarkup(React.createElement(ProductionExportDialog, {
    open: true,
    initialMode: "custom",
    initialAnchorDate: "2026-08-17",
    initialFromDate: "2026-08-10",
    initialUntilDate: "2026-08-17",
  }));

  expect(html).toContain("Bỏ Chủ nhật");
  expect(html).toContain('type="checkbox"');
  expect(html).toContain("checked");
});
