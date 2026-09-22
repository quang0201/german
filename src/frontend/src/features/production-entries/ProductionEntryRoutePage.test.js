import React from "react";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { ToastProvider } from "../../components/erp/ToastProvider.jsx";
import { ProductionEntryRoutePage } from "./ProductionEntryRoutePage.jsx";

function renderFor(role) {
  return renderToStaticMarkup(
    <ToastProvider>
      <ProductionEntryRoutePage session={{ role }} />
    </ToastProvider>,
  );
}

describe("ProductionEntryRoutePage", () => {
  test("keeps Worker on the existing period/list production flow", () => {
    const html = renderFor("Worker");
    expect(html).toContain('aria-label="Chọn kỳ"');
    expect(html).toContain("Hôm nay");
    expect(html).not.toContain("Theo dõi và nhập sản lượng theo ma trận tháng");
  });

  test("routes Manager and Admin to the grouped weekly matrix flow without a second workspace tab bar", () => {
    for (const role of ["Manager", "Admin"]) {
      const html = renderFor(role);
      expect(html).toContain("erp-production-controls");
      expect(html).toContain("Xuất Excel");
      expect(html).toContain("+ Nhập sản lượng");
      expect(html).toContain("Tuần trước");
      expect(html).toContain("Tuần sau");
      expect(html).not.toContain("Tổng lượt công đoạn");
      expect(html).not.toContain("Bản ghi");
      expect(html).not.toContain("14/09/2026 → 20/09/2026");
      expect(html).not.toContain('aria-label="Chọn kỳ"');
    }
  });

  test("does not route manager production through the combined workspace", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryRoutePage.jsx"), "utf8");

    expect(source).toContain("ProductionEntryManagerMatrixPage");
    expect(source).not.toContain("ProductionAttendanceWorkspace");
  });

  test("keeps the full Monday-to-Sunday week in the manager production matrix", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryManagerMatrixPage.jsx"), "utf8");

    expect(source).toContain("buildProductionWeeklyMatrixUrl");
    expect(source).toContain('excludeSundays={false}');
    expect(source).toContain('showSundayToggle={false}');
    expect(source).toContain("availableOrders[0].id");
  });

  test("groups manager production controls and removes the duplicate page heading", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryManagerMatrixPage.jsx"), "utf8");

    expect(source).toContain("erp-production-controls");
    expect(source).toContain("showOrderFilter={false}");
    expect(source).toContain("<Field label=\"Mã sản xuất\">");
    expect(source).not.toContain("<PageHeader");
  });
});
