import { describe, expect, test } from "bun:test";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { Sidebar } from "./Sidebar.jsx";

const frontendRoot = resolve(import.meta.dir, "../..");

function read(relativePath) {
  return readFileSync(resolve(frontendRoot, relativePath), "utf8");
}

describe("Industrial Clarity visual system", () => {
  test("honors the locked ERP density and radius contract", () => {
    const styles = read("src/styles.css");

    expect(styles).toContain("--radius-sm: 7px;");
    expect(styles).toContain("--radius-md: 10px;");
    expect(styles).toContain("--control-height: 34px;");
    expect(styles).toContain("--table-row-height: 34px;");
    expect(styles).toContain("--color-text-muted: #465b60;");
    expect(styles).toContain("--color-primary: #0f766e;");
    expect(styles).toContain("--color-focus-ring: #0f766e;");
    expect(styles).toContain("--color-paid-leave: #2563eb;");
    expect(styles).toMatch(/\.erp-page-title\s*\{[^}]*font-size:\s*24px/s);
    expect(styles).toMatch(/\.erp-nav-item\s*\{[^}]*min-height:\s*var\(--control-height\)/s);
  });

  test("keeps buttons crisp with a restrained corner radius", () => {
    const styles = read("src/styles.css");

    expect(styles).toContain("--radius-button: 3px;");
    expect(styles).toMatch(/\.erp-button\s*\{[^}]*border-radius:\s*var\(--radius-button\)/s);
    expect(styles).toMatch(/\.erp-button-link\s*\{[^}]*border-radius:\s*var\(--radius-button\)/s);
    expect(styles).toMatch(/\.erp-nav-item\s*\{[^}]*border-radius:\s*var\(--radius-button\)/s);
    expect(styles).toMatch(/\.erp-sidebar-toggle\s*\{[^}]*border-radius:\s*var\(--radius-button\)/s);
  });

  test("uses consistent surfaces for page headers, filters, tables, and forms", () => {
    const styles = read("src/styles.css");

    expect(styles).toMatch(/\.erp-page-header\s*\{[^}]*background:\s*var\(--color-surface\)/s);
    expect(styles).toMatch(/\.erp-filter-bar\s*\{[^}]*border-radius:\s*10px/s);
    expect(styles).toMatch(/\.erp-form-section\s*\{[^}]*background:\s*var\(--color-surface\)/s);
    expect(styles).toMatch(/\.erp-report-toolbar\s*\{[^}]*background:\s*var\(--color-surface\)/s);
    expect(styles).toMatch(/\.erp-table th\s*\{[^}]*background:\s*#eaf2f3/s);
    expect(styles).toMatch(/\.erp-production-manager-page \.erp-page-header\s*\{[^}]*background:\s*transparent/s);
  });

  test("uses a shared SVG icon component instead of text glyph navigation icons", () => {
    const sidebar = read("src/app/Sidebar.jsx");

    expect(sidebar).toContain('import { Icon } from "../components/erp/Icon.jsx";');
    expect(sidebar).not.toContain('"⌂"');
    expect(sidebar).not.toContain('"▤"');
    expect(sidebar).toContain('<Icon name={icons[route.path] || "production"}');
    expect(sidebar).not.toContain("<Icon name={icons[route.path] || \"production\"} label={label}");
  });

  test("keeps sidebar navigation buttons named when labels are visually hidden", () => {
    const html = renderToString(
      React.createElement(Sidebar, { role: "Admin", pathname: "/reports", collapsed: false })
    );

    expect(html).toContain('aria-label="Báo cáo"');
    expect(html).not.toContain('aria-label="Tổng quan"');
    expect(html).toContain('aria-label="Sản lượng"');
    expect(html).toContain('aria-label="Tài khoản"');
  });

  test("provides a visible keyboard focus ring across interactive controls", () => {
    const styles = read("src/styles.css");

    expect(styles).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus-ring\)/s);
  });
});
