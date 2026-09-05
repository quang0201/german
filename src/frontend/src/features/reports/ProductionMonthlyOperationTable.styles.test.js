import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("ProductionMonthlyOperationTable CSS", () => {
  test("keeps the operation column visible during horizontal scrolling", () => {
    expect(styles).toMatch(/\.erp-report-monthly-table thead th:first-child[\s\S]*position:\s*sticky[\s\S]*left:\s*0/);
    expect(styles).toMatch(/\.erp-report-monthly-table tbody th[\s\S]*position:\s*sticky[\s\S]*left:\s*0[\s\S]*background:\s*var\(--color-surface\)/);
  });

  test("emphasizes the latest month and cumulative column", () => {
    expect(styles).toMatch(/\.erp-report-monthly-table th\.is-latest,[\s\S]*\.erp-report-monthly-table td\.is-latest[\s\S]*background:\s*var\(--color-primary-soft\)/);
    expect(styles).toMatch(/\.erp-report-monthly-table th\.is-cumulative,[\s\S]*\.erp-report-monthly-table td\.is-cumulative[\s\S]*background:\s*var\(--color-primary-soft\)/);
  });

  test("provides a compact plan indicator and mobile scroll guidance", () => {
    expect(styles).toMatch(/\.erp-report-plan-indicator[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/\.erp-report-table-scroll-hint[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*\.erp-report-table-scroll-hint[\s\S]*display:\s*block/);
  });
});
