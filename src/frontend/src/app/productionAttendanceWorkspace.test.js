import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "../components/erp/ToastProvider.jsx";
import { ProductionAttendanceWorkspace } from "../features/production-entries/ProductionAttendanceWorkspace.jsx";

describe("ProductionAttendanceWorkspace", () => {
  test("offers production and attendance entry in one workspace", () => {
    const html = renderToString(React.createElement(ToastProvider, null, React.createElement(ProductionAttendanceWorkspace, {
      session: { role: "Manager" },
    })));

    expect(html).toContain("Nhập liệu sản lượng và chấm công");
    expect(html).toContain("Nhập sản lượng");
    expect(html).toContain("Chấm công");
  });
});
