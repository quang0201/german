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

    expect(html).toContain("Tạo mã MCP");
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
});
