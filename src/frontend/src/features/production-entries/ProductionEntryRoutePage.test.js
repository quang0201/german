import React from "react";
import { describe, expect, test } from "bun:test";
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

  test("routes Manager and Admin to the monthly matrix flow", () => {
    for (const role of ["Manager", "Admin"]) {
      const html = renderFor(role);
      expect(html).toContain("Theo dõi và nhập sản lượng theo ma trận tháng");
      expect(html).toContain("Ẩn Chủ nhật");
      expect(html).not.toContain('aria-label="Chọn kỳ"');
    }
  });
});
