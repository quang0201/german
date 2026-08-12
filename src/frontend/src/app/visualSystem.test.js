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

    expect(styles).toContain("--radius-sm: 4px;");
    expect(styles).toContain("--radius-md: 6px;");
    expect(styles).toContain("--control-height: 38px;");
    expect(styles).toContain("--table-row-height: 42px;");
    expect(styles).toContain("--color-text-muted: #475569;");
    expect(styles).toContain("--color-focus-ring: #2563eb;");
    expect(styles).toMatch(/\.erp-page-title\s*\{[^}]*font-size:\s*24px/s);
    expect(styles).toMatch(/\.erp-nav-item\s*\{[^}]*min-height:\s*var\(--control-height\)/s);
  });

  test("keeps workflow sections flat instead of turning each group into a card", () => {
    const styles = read("src/styles.css");

    expect(styles).toMatch(/\.erp-filter-bar\s*\{[^}]*border-bottom:\s*1px solid var\(--color-border\)/s);
    expect(styles).not.toMatch(/\.erp-filter-bar\s*\{[^}]*box-shadow:/s);
    expect(styles).toMatch(/\.erp-form-section\s*\{[^}]*border-bottom:\s*1px solid var\(--color-border\)/s);
    expect(styles).not.toMatch(/\.erp-form-section\s*\{[^}]*box-shadow:/s);
    expect(styles).toMatch(/\.erp-report-toolbar\s*\{[^}]*border-bottom:\s*1px solid var\(--color-border\)/s);
    expect(styles).not.toMatch(/\.erp-summary-grid\s*>\s*div\s*\{[^}]*box-shadow:/s);
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
      React.createElement(Sidebar, { role: "Admin", pathname: "/overview", collapsed: false })
    );

    expect(html).toContain('aria-label="Tổng quan"');
    expect(html).toContain('aria-label="Sản lượng"');
    expect(html).toContain('aria-label="Tài khoản"');
  });

  test("provides a visible keyboard focus ring across interactive controls", () => {
    const styles = read("src/styles.css");

    expect(styles).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus-ring\)/s);
  });
});
