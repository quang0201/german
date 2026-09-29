import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const matrixCss = readFileSync(new URL("./ProductionMonthlyMatrix.css", import.meta.url), "utf8");
const dialogsCss = readFileSync(new URL("./ProductionMatrixDialogs.css", import.meta.url), "utf8");

describe("ProductionMonthlyMatrix responsive CSS", () => {
  test("releases sticky-right totals when the viewport is too narrow", () => {
    expect(matrixCss).toMatch(/@media \(max-width: 900px\)[\s\S]*\.erp-month-total-all[\s\S]*right:\s*auto/);
    expect(matrixCss).toMatch(/@media \(max-width: 900px\)[\s\S]*tbody \.erp-month-total[\s\S]*position:\s*static/);
  });

  test("uses the shared ERP color tokens instead of feature-local color literals", () => {
    const featureCss = `${matrixCss}\n${dialogsCss}`;
    expect(featureCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(featureCss).not.toMatch(/\brgba?\(/i);
  });

  test("marks existing batch operations with a success state", () => {
    expect(dialogsCss).toContain(".erp-matrix-operation-existing");
    expect(dialogsCss).toContain("var(--color-success-soft)");
    expect(dialogsCss).toContain("✓");
  });

  test("keeps sticky employee and operation headers above scrolling day headers", () => {
    expect(matrixCss).toMatch(/\.erp-month-matrix-table thead \.erp-month-sticky-employee,[\s\n]*\.erp-month-matrix-table thead \.erp-month-sticky-operation[\s\S]*z-index:\s*12/);
  });

  test("keeps sticky total headers above scrolling day subheaders", () => {
    expect(matrixCss).toMatch(/\.erp-month-matrix-table thead \.erp-month-total[\s\S]*z-index:\s*12/);
  });

  test("aligns row-spanned employee names with the first operation row", () => {
    expect(matrixCss).toMatch(/\.erp-month-employee[\s\S]*vertical-align:\s*top[\s\S]*padding-top:\s*10px\s*!important/);
  });

  test("gives two-row sticky headers the full combined height", () => {
    expect(matrixCss).toMatch(/thead tr:first-child th:not\(\[rowspan="2"\]\)[\s\S]*height:\s*46px/);
    expect(matrixCss).toMatch(/thead th\[rowspan="2"\][\s\S]*top:\s*0[\s\S]*height:\s*77px\s*!important[\s\S]*vertical-align:\s*middle/);
  });

  test("keeps weekends neutral and highlights today with a restrained tint", () => {
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-sunday[\s\S]*background:/);
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-sunday[\s\S]*color:/);
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-today[\s\S]*background:/);
  });

  test("separates employee groups and gives blank status cells a non-color marker", () => {
    expect(matrixCss).toContain("erp-month-group-start");
    expect(matrixCss).toContain("erp-month-group-alt");
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-no-attendance button:empty::after { content:"?"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-missing button:empty::after { content:"!"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-paid-leave button:empty::after { content:"P"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-no-attendance button:not(:empty)::before { content:"? "');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-paid-leave button:not(:empty)::before { content:"P "');
    expect(matrixCss).toContain("border-right:1px solid var(--color-border); border-bottom:1px solid var(--color-border);");
  });

  test("uses one status accent per HC/TC pair instead of double vertical bars", () => {
    expect(matrixCss).toContain("erp-month-status-marker.erp-month-no-attendance { box-shadow:inset 3px 0");
    expect(matrixCss).not.toContain(".erp-month-value-cell.erp-month-no-attendance { background:color-mix(in srgb, var(--color-error) 5%, var(--color-surface)) !important; box-shadow");
  });

  test("keeps future blank cells neutral and explains that state in the legend", () => {
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-future");
    expect(matrixCss).toContain(".is-future-date");
  });

  test("makes date and cell entry affordances visible without hover", () => {
    expect(matrixCss).toContain(".erp-month-day-head .erp-month-day-action");
    expect(matrixCss).toContain(".erp-month-value-cell button:empty::after { content:\"+\"; opacity:.34;");
    expect(matrixCss).not.toContain("button:empty::after { content:\"+\"; opacity:0");
    expect(matrixCss).toContain(".erp-month-matrix-help");
  });

  test("uses clear gridlines and tracks the hovered cell's employee row and date column", () => {
    expect(matrixCss).toContain("border-right:1px solid var(--color-border); border-bottom:1px solid var(--color-border);");
    expect(matrixCss).toContain(".erp-month-hover-row:not(.erp-month-inactive) > td");
    expect(matrixCss).toContain(".erp-month-hover-column");
    expect(matrixCss).toContain(".erp-month-hover-cell");
    expect(matrixCss).toContain(".erp-month-hover-day");
    expect(matrixCss).toContain(".erp-month-cell-tooltip { position:fixed;");
  });
});
