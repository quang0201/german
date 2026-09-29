import { describe, expect, test } from "bun:test";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { AppShell } from "./AppShell.jsx";

const styles = readFileSync(resolve(import.meta.dir, "../styles.css"), "utf8");
const productionListPage = readFileSync(resolve(import.meta.dir, "../features/production-entries/ProductionEntryListPage.jsx"), "utf8");
const productionManagerMatrixPage = readFileSync(resolve(import.meta.dir, "../features/production-entries/ProductionEntryManagerMatrixPage.jsx"), "utf8");

describe("ERP responsive CSS contract", () => {
  test("uses a calm shared shell and restrained table headings across pages", () => {
    expect(styles).toContain("--color-bg: #f2f5f2;");
    expect(styles).toContain("background: #edf2ef; color: var(--color-text-muted); transition: width 160ms ease;");
    expect(styles).toContain(".erp-nav-item.is-active { border-color: #c7ddd5; background: #dcebe5;");
    expect(styles).toContain("font-size: 12px; font-weight: 750; letter-spacing: .015em; white-space: nowrap;");
  });

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

  test("hides the desktop collapse control inside tablet and mobile drawers", () => {
    expect(styles).toMatch(
      /@media \(max-width: 1023px\)\s*\{\s*\.mobile-nav-open \.erp-sidebar-toggle\s*\{\s*display:\s*none;/s
    );
  });

  test("uses mobile priority columns and multi-row pagination", () => {
    expect(styles).toContain(".erp-column-mobile-hidden { display: none; }");
    expect(styles).toContain(".erp-pagination { grid-template-columns: 1fr auto; gap: 10px 14px; }");
    expect(styles).toContain(".erp-topbar-search { display: none; }");
  });

  test("keeps mobile topbar actions compact without truncating the page context", () => {
    const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 767px)"));

    expect(mobileStyles).toMatch(/\.erp-topbar-context\s*\{[^}]*min-width:\s*0;/s);
    expect(mobileStyles).toContain(".erp-topbar-mcp-full { display: none; }");
    expect(mobileStyles).toContain(".erp-topbar-mcp-compact { display: inline; }");
    expect(mobileStyles).toContain(".erp-topbar-logout-compact { display: none; }");
  });

  test("keeps text-only link actions large enough to tap", () => {
    expect(styles).toMatch(/\.erp-button-link\s*\{[^}]*min-width:\s*44px;/s);
  });

  test("keeps the production summary responsive without changing ERP tokens", () => {
    const mobileStyles = styles.slice(
      styles.indexOf("@media (max-width: 767px) {"),
      styles.indexOf("@media (max-width: 640px) {")
    );

    expect(styles).toContain(".erp-production-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));");
    expect(styles).toContain("@media (min-width: 1024px) and (max-width: 1279px) {");
    expect(styles).toContain(".erp-production-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }");
    expect(styles).toContain("@media (min-width: 768px) and (max-width: 1023px) {");
    expect(mobileStyles).toContain(".erp-production-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }");
    expect(mobileStyles).toContain(".erp-period-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(styles).toContain(".erp-period-presets { display: flex; flex-wrap: wrap;");
  });

  test("gives the manager monthly matrix the remaining viewport and internal scroll", () => {
    expect(styles).toContain(".erp-production-manager-content {");
    expect(styles).toContain(".erp-content.erp-production-manager-content {");
    expect(styles).toContain("width: 100%;");
    expect(styles).toContain("max-width: none;");
    expect(styles).toContain("height: calc(100dvh - var(--app-header-height));");
    expect(styles).toContain('.erp-production-attendance-workspace > [role="tabpanel"] { min-width: 0;');
    expect(styles).toContain('.erp-production-manager-content > .erp-production-attendance-workspace { flex: 1; min-height: 0;');
    expect(styles).toContain('.erp-production-attendance-workspace > [role="tabpanel"] { min-height: 0;');
    expect(styles).toContain(".erp-production-manager-page .erp-month-matrix-section {");
    expect(styles).toContain(".erp-production-manager-page .erp-month-matrix-scroll {");
    expect(styles).toContain("max-height: none;");
    expect(productionManagerMatrixPage).toContain("erp-production-manager-page");
    expect(productionManagerMatrixPage).toContain("erp-production-controls");
  });

  test("keeps mobile manager controls compact and gives the matrix the remaining viewport", () => {
    const mobileStyles = styles.slice(styles.lastIndexOf("@media (max-width: 767px)"));
    expect(mobileStyles).toMatch(/\.erp-production-manager-content\s*\{[^}]*height:\s*calc\(100dvh - var\(--app-header-height\)\);[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(mobileStyles).toMatch(/\.erp-production-manager-page\s*\{[^}]*height:\s*100%;/s);
    expect(mobileStyles).toMatch(/\.erp-production-manager-page \.erp-month-matrix-scroll\s*\{[^}]*max-height:\s*none;/s);
    expect(styles).toContain(".erp-production-filter-panel { display:none; }");
    expect(styles).toMatch(/\.erp-production-filter-panel\.is-open\s*\{[^}]*display:\s*block;[^}]*position:\s*fixed;/s);
    expect(mobileStyles).toContain(".erp-production-filter-panel-header");
    expect(mobileStyles).toContain(".erp-production-manager-content > nav { display:none; }");
    expect(styles).toContain(".erp-production-filter-close { min-height:44px;");
    expect(mobileStyles).toContain(".erp-icon-button { width:44px; height:44px; }");
  });

  test("keeps weekly matrix navigation fully visible on narrow mobile screens", () => {
    const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 640px)"));

    expect(mobileStyles).toContain("grid-template-columns:44px minmax(0, 1fr) 44px;");
    expect(mobileStyles).toContain("grid-template-columns:repeat(2, minmax(0, 1fr));");
    expect(mobileStyles).toContain(".erp-production-month-nav-button span:not([aria-hidden]) { display:none; }");
    expect(mobileStyles).toContain(".erp-production-month-nav-button { min-width:44px;");
  });

  test("integrates the production page period, summary, export, and grouped table contracts", () => {
    expect(productionListPage).toContain('import { PeriodSelector } from "./PeriodSelector.jsx";');
    expect(productionListPage).toContain('import { ProductionSummary } from "./ProductionSummary.jsx";');
    expect(productionListPage).toContain('import { ProductionEntryGroupedTable } from "./ProductionEntryGroupedTable.jsx";');
    expect(productionListPage).toContain("localIsoDate()");
    expect(productionListPage).toContain("buildProductionExportUrl({ ...filters, ...exportRange })");
    expect(productionListPage).toContain("<ProductionExportDialog");
    expect(productionListPage).toContain("exportDialogOpen");
    expect(productionListPage).toContain("multiDay={filters.fromDate !== filters.untilDate}");
    expect(productionListPage).toContain('const [appliedPeriod, setAppliedPeriod]');
    expect(productionListPage).toContain('const [isCustomEditing, setIsCustomEditing]');
    expect(productionListPage).toContain("{exportLabel(appliedPeriod.periodMode)}");
    expect(productionListPage).toContain("isCustomEditing={isCustomEditing}");
    expect(productionListPage).toContain('density="normal"');
    expect(productionListPage).toContain("setCustomDraft({ fromDate: filters.fromDate, untilDate: filters.untilDate });");
    expect(productionListPage).toContain("setIsCustomEditing(true);");
    expect(productionListPage).toContain("setAppliedPeriod((current) => ({");
    expect(productionListPage).toContain("fromDate: customDraft.fromDate, untilDate: customDraft.untilDate, page: 1");

    const markup = productionListPage.slice(productionListPage.indexOf("return ("));
    expect(markup.indexOf("<PageHeader")).toBeLessThan(markup.indexOf("<PeriodSelector"));
    expect(markup.indexOf("<PeriodSelector")).toBeLessThan(markup.indexOf("<ProductionSummary"));
    expect(markup.indexOf("<ProductionSummary")).toBeLessThan(markup.indexOf("<FilterBar"));
    expect(markup.indexOf("<FilterBar")).toBeLessThan(markup.indexOf("<ProductionEntryGroupedTable"));
    expect(markup.indexOf("<ProductionEntryGroupedTable")).toBeLessThan(markup.indexOf("<Pagination"));
  });
});
