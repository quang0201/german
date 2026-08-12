import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Icon } from "./Icon.jsx";

describe("ERP icons", () => {
  test("renders a real SVG icon with an accessible label", () => {
    const html = renderToString(React.createElement(Icon, { name: "production", label: "Sản lượng" }));
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="Sản lượng"');
    expect(html).not.toContain("▤");
  });

  test("provides distinct shell icons for menu search and logout", () => {
    const production = renderToString(React.createElement(Icon, { name: "production" }));
    const menu = renderToString(React.createElement(Icon, { name: "menu" }));
    const search = renderToString(React.createElement(Icon, { name: "search" }));
    const logout = renderToString(React.createElement(Icon, { name: "logout" }));

    expect(menu).not.toBe(production);
    expect(search).not.toBe(production);
    expect(logout).not.toBe(production);
    expect(new Set([menu, search, logout]).size).toBe(3);
  });
});
