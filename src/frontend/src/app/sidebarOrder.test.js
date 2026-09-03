import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Sidebar } from "./Sidebar.jsx";

describe("Sidebar navigation order", () => {
  test("removes overview and prioritizes report, master data, attendance, then production", () => {
    const html = renderToString(React.createElement(Sidebar, { role: "Manager", pathname: "/reports", collapsed: false }));
    const labels = [...html.matchAll(/<span class="erp-nav-label">([^<]+)<\/span>/g)].map((match) => match[1]);

    expect(labels).toEqual(["Báo cáo", "Báo cáo tháng", "Nhân viên", "Mã sản xuất", "Chấm công", "Sản lượng", "Ca làm việc"]);
    expect(html).not.toContain("Tổng quan");
  });

  test("marks only the monthly report item active on the monthly report screen", () => {
    const html = renderToString(React.createElement(Sidebar, { role: "Manager", pathname: "/reports/monthly", collapsed: false }));
    const activeLabels = [...html.matchAll(/<button[^>]*class="erp-nav-item is-active"[^>]*>[\s\S]*?<span class="erp-nav-label">([^<]+)<\/span><\/button>/g)]
      .map((match) => match[1]);

    expect(activeLabels).toEqual(["Báo cáo tháng"]);
  });
});
