import { describe, expect, test } from "bun:test";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { AppShell } from "./AppShell.jsx";

const styles = readFileSync(resolve(import.meta.dir, "../styles.css"), "utf8");
const productionListPage = readFileSync(resolve(import.meta.dir, "../features/production-entries/ProductionEntryListPage.jsx"), "utf8");

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
    expect(mobileStyles).toContain(".erp-period-presets { flex-wrap: nowrap; overflow-x: auto;");
    expect(styles).toContain(".erp-period-presets { display: flex; flex-wrap: wrap;");
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
