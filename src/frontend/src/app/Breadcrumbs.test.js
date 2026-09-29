import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Breadcrumbs } from "./Breadcrumbs.jsx";

describe("Breadcrumbs", () => {
  test("hides a one-item trail when it would repeat the page title", () => {
    expect(renderToString(React.createElement(Breadcrumbs, { items: [{ label: "Nhân viên" }] }))).toBe("");
  });

  test("keeps a useful trail for nested screens", () => {
    const html = renderToString(React.createElement(Breadcrumbs, {
      items: [{ label: "Mã sản xuất", href: "/orders" }, { label: "4004 đen" }],
    }));

    expect(html).toContain('aria-label="Điều hướng phân cấp"');
    expect(html).toContain("Mã sản xuất");
    expect(html).toContain("4004 đen");
    expect(html).toContain('class="erp-breadcrumb-current"');
  });
});
