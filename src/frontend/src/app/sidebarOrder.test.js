import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Sidebar } from "./Sidebar.jsx";

describe("Sidebar navigation order", () => {
  test("puts daily work first, then reports, master data and administration", () => {
    const html = renderToString(React.createElement(Sidebar, { role: "Manager", pathname: "/reports", collapsed: false }));
    const labels = [...html.matchAll(/<span class="erp-nav-label">([^<]+)<\/span>/g)].map((match) => match[1]);

    expect(labels).toEqual(["Sản lượng", "Chấm công", "Báo cáo", "Báo cáo tháng", "Nhân viên", "Mã sản xuất", "Sản phẩm", "Gia công ngoài", "Ca làm việc"]);
    expect(html).toContain('aria-label="Hằng ngày"');
    expect(html).toContain('aria-label="Báo cáo"');
    expect(html).toContain('aria-label="Danh mục"');
    expect(html).not.toContain("Tổng quan");
  });

  test("gives each menu item its own icon so the list is easy to scan", () => {
    const html = renderToString(React.createElement(Sidebar, { role: "Admin", pathname: "/reports", collapsed: false }));
    const icons = [...html.matchAll(/<span class="erp-nav-icon">([\s\S]*?)<\/span>/g)].map((match) => match[1]);
    expect(new Set(icons).size).toBe(icons.length);
  });

  test("marks only the monthly report item active on the monthly report screen", () => {
    const html = renderToString(React.createElement(Sidebar, { role: "Manager", pathname: "/reports/monthly", collapsed: false }));
    const activeLabels = [...html.matchAll(/<button[^>]*class="erp-nav-item is-active"[^>]*>[\s\S]*?<span class="erp-nav-label">([^<]+)<\/span><\/button>/g)]
      .map((match) => match[1]);

    expect(activeLabels).toEqual(["Báo cáo tháng"]);
  });
});
