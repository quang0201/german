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

  test("routes Manager and Admin to the monthly matrix flow without a second workspace tab bar", () => {
    for (const role of ["Manager", "Admin"]) {
      const html = renderFor(role);
      expect(html).toContain("Theo dõi và nhập sản lượng theo ma trận tháng");
      expect(html).toContain("Ẩn Chủ nhật");
      expect(html).not.toContain('aria-label="Chọn kỳ"');
    }
  });

  test("does not route manager production through the combined workspace", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryRoutePage.jsx"), "utf8");

    expect(source).toContain("ProductionEntryManagerMatrixPage");
    expect(source).not.toContain("ProductionAttendanceWorkspace");
  });

  test("shows Sundays by default in the manager production matrix", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryManagerMatrixPage.jsx"), "utf8");

    expect(source).toContain('const [excludeSundays, setExcludeSundays] = useState(false);');
  });
});
