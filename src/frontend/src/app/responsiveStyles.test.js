import { describe, expect, test } from "bun:test";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { AppShell } from "./AppShell.jsx";

const styles = readFileSync(resolve(import.meta.dir, "../styles.css"), "utf8");

describe("ERP responsive CSS contract", () => {
  test("defines compact sidebar and drawer breakpoints", () => {
    expect(styles).toContain("@media (min-width: 1024px) and (max-width: 1279px)");
    expect(styles).toContain("@media (min-width: 768px) and (max-width: 1023px)");
    expect(styles).toContain("@media (max-width: 767px)");
  });

  test("defaults compact desktop to collapsed while preserving a real expand toggle", () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    };

    try {
      const html = renderToString(
        React.createElement(
          AppShell,
          {
            session: { role: "Admin", username: "quang" },
            pathname: "/overview",
            breadcrumbs: [],
            onLogout() {}
          },
          React.createElement("div", null, "Nội dung")
        )
      );
      const compactStyles = styles.slice(
        styles.indexOf("@media (min-width: 1024px) and (max-width: 1279px)"),
        styles.indexOf("@media (min-width: 768px) and (max-width: 1023px)")
      );

      expect(html).toContain("sidebar-collapsed");
      expect(html).toContain('aria-label="Mở rộng menu"');
      expect(compactStyles).not.toContain(".erp-sidebar-layer { width: var(--sidebar-width-collapsed); }");
      expect(compactStyles).not.toContain(".erp-nav-label { display: none; }");
    } finally {
      globalThis.window = originalWindow;
    }
  });

  test("keeps mobile navigation expanded and locks body scroll", () => {
    expect(styles).toContain("body.erp-mobile-nav-open { overflow: hidden; }");
    expect(styles).toContain(".mobile-nav-open .erp-nav-label { display: block; }");
  });

  test("uses mobile priority columns and multi-row pagination", () => {
    expect(styles).toContain(".erp-column-mobile-hidden { display: none; }");
    expect(styles).toContain(".erp-pagination { grid-template-columns: 1fr auto; gap: 10px 14px; }");
    expect(styles).toContain(".erp-topbar-search { display: none; }");
  });
});
