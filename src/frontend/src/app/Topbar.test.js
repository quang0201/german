import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Topbar } from "./Topbar.jsx";

describe("Topbar", () => {
  test("shows MCP session copy action to managers", () => {
    const html = renderToString(React.createElement(Topbar, {
      session: { role: "Manager", username: "manager" },
      onLogout: () => {},
      onMenu: () => {},
    }));

    expect(html).toContain("Tạo token MCP");
    expect(html).toContain("kết nối MCP");
  });

  test("does not expose MCP session action to workers", () => {
    const html = renderToString(React.createElement(Topbar, {
      session: { role: "Worker", username: "worker" },
      onLogout: () => {},
      onMenu: () => {},
    }));

    expect(html).not.toContain("Copy session MCP");
  });

  test("uses the current page label when the route has no breadcrumb", () => {
    const html = renderToString(React.createElement(Topbar, {
      session: { role: "Admin", username: "admin" },
      pathname: "/reports",
      breadcrumbs: [],
      onLogout: () => {},
      onMenu: () => {},
    }));

    expect(html).toContain('class="erp-topbar-context">Báo cáo</div>');
  });

  test("keeps compact mobile labels accessible by their full action names", () => {
    const html = renderToString(React.createElement(Topbar, {
      session: { role: "Admin", username: "admin" },
      onLogout: () => {},
      onMenu: () => {},
    }));

    expect(html).toContain('aria-label="Tạo token MCP"');
    expect(html).toContain('aria-label="Đăng xuất"');
    expect(html).toContain("erp-topbar-mcp-compact");
  });
});
