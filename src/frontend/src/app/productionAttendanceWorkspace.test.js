import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ToastProvider } from "../components/erp/ToastProvider.jsx";
import { ProductionAttendanceWorkspace } from "../features/production-entries/ProductionAttendanceWorkspace.jsx";

describe("ProductionAttendanceWorkspace", () => {
  test("offers production and attendance entry in one workspace", () => {
    const html = renderToString(React.createElement(ToastProvider, null, React.createElement(ProductionAttendanceWorkspace, {
      session: { role: "Manager" },
    })));

    expect(html).not.toContain("Nhập liệu chung");
    expect(html).not.toContain("Nhập liệu sản lượng và chấm công");
    expect(html).not.toContain("Một màn hình cho phép chuyển nhanh giữa sản lượng và giờ công của cùng kỳ làm việc.");
    expect(html).toContain("Nhập sản lượng");
    expect(html).toContain("Chấm công");
  });

  test("keeps visited tabs mounted so switching back can preserve local drafts", () => {
    const source = readFileSync(resolve(import.meta.dir, "../features/production-entries/ProductionAttendanceWorkspace.jsx"), "utf8");
    expect(source).toContain("visitedViews");
    expect(source).toContain("hidden={activeView !==");
    expect(source).toContain("setVisitedViews");
  });
});
