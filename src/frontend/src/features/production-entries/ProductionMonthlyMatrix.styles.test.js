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

  test("keeps employee and operation headers fixed above single-row dates", () => {
    expect(matrixCss).toMatch(/\.erp-month-matrix-table thead \.erp-month-sticky-employee,[\s\n]*\.erp-month-matrix-table thead \.erp-month-sticky-operation[\s\S]*z-index:\s*12/);
    expect(matrixCss).toContain(".erp-month-matrix-table thead tr:first-child th { top:0; height:68px;");
    expect(matrixCss).not.toContain("thead tr:nth-child(2)");
  });

  test("keeps sticky total headers aligned with the single date header row", () => {
    expect(matrixCss).toMatch(/\.erp-month-matrix-table thead \.erp-month-total[\s\S]*z-index:\s*12/);
  });

  test("aligns row-spanned employee names with the first operation row", () => {
    expect(matrixCss).toMatch(/\.erp-month-employee[\s\S]*vertical-align:\s*top[\s\S]*padding-top:\s*10px\s*!important/);
    expect(matrixCss).toContain("--erp-month-employee-column-width:15ch;");
    expect(matrixCss).toContain(".erp-month-employee-name { display:-webkit-box;");
    expect(matrixCss).toContain("-webkit-line-clamp:2;");
    expect(matrixCss).toContain("overflow-wrap:anywhere;");
  });

  test("gives the single sticky header row enough height for the date and total", () => {
    expect(matrixCss).toContain(".erp-month-matrix-table thead tr:first-child th { top:0; height:68px; vertical-align:middle; }");
  });

  test("keeps weekends neutral and highlights today with a restrained tint", () => {
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-sunday[\s\S]*background:/);
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-sunday[\s\S]*color:/);
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-today[\s\S]*background:/);
  });

  test("separates employee groups and gives blank status cells a non-color marker", () => {
    expect(matrixCss).toContain("erp-month-group-start");
    expect(matrixCss).not.toContain("erp-month-group-alt");
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-no-attendance button:empty::after { content:"?"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-missing button:empty::after { content:"!"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-paid-leave button:empty::after { content:"P"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-no-attendance button:not(:empty)::before { content:"? "');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-paid-leave button:not(:empty)::before { content:"P "');
    expect(matrixCss).toContain("border-right:1px solid color-mix(in srgb, var(--color-border-strong) 48%, var(--color-surface)); border-bottom:1px solid color-mix(in srgb, var(--color-border-strong) 48%, var(--color-surface));");
  });

  test("uses a stronger cell grid and one status accent per daily total", () => {
    expect(matrixCss).toContain("border-right:1px solid color-mix(in srgb, var(--color-border-strong) 48%, var(--color-surface));");
    expect(matrixCss).toContain("erp-month-status-marker.erp-month-no-attendance { box-shadow:inset 3px 0");
    expect(matrixCss).toContain(".erp-month-value-cell { min-width:82px; width:82px;");
  });

  test("keeps future blank cells neutral and explains that state in the legend", () => {
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-future");
    expect(matrixCss).toContain(".is-future-date");
  });

  test("makes date and cell entry affordances visible without hover", () => {
    expect(matrixCss).toContain(".erp-month-day-head .erp-month-day-action");
    expect(matrixCss).toContain(".erp-month-value-cell button:empty::after { content:\"+\"; opacity:.62;");
    expect(matrixCss).not.toContain("button:empty::after { content:\"+\"; opacity:0");
    expect(matrixCss).toContain(".erp-month-matrix-help");
  });

  test("uses clear gridlines and tracks the hovered cell's employee row and date column", () => {
    expect(matrixCss).toContain("border-right:1px solid color-mix(in srgb, var(--color-border-strong) 48%, var(--color-surface)); border-bottom:1px solid color-mix(in srgb, var(--color-border-strong) 48%, var(--color-surface));");
    expect(matrixCss).toContain(".erp-month-hover-row:not(.erp-month-inactive) > td");
    expect(matrixCss).toContain(".erp-month-hover-column");
    expect(matrixCss).toContain(".erp-month-hover-cell");
    expect(matrixCss).toContain(".erp-month-hover-day");
    expect(matrixCss).toContain(".erp-month-cell-tooltip { position:fixed;");
    expect(matrixCss).toContain("td.erp-month-hover-column { box-shadow:inset 2px 0 var(--color-primary), inset -2px 0 var(--color-primary); }");
    expect(matrixCss).toContain("td.erp-month-hover-cell { box-shadow:inset 0 0 0 2px var(--color-primary-strong); }");
    expect(matrixCss).not.toContain("td.erp-month-hover-column { outline:");
  });

  test("uses legible semantic tints for warnings, missing attendance, and paid leave", () => {
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-missing { background:var(--color-warning-soft) !important; }");
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-no-attendance { background:var(--color-error-soft) !important; }");
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-paid-leave { background:var(--color-paid-leave-soft) !important; }");
  });

  test("uses restrained square corners for matrix controls and entry dialogs", () => {
    expect(matrixCss).toContain(".erp-month-day-head .erp-month-day-action { display:inline-flex;");
    expect(matrixCss).toContain("border-radius:2px;");
    expect(matrixCss).toContain("border-left-width:3px; border-radius:3px; background:var(--color-surface);");
    expect(dialogsCss).toContain(".erp-dialog.erp-matrix-dialog,.erp-dialog.erp-matrix-batch-dialog{border-radius:4px}");
    expect(dialogsCss).toContain(".erp-dialog.erp-matrix-dialog .erp-mode-option,.erp-dialog.erp-matrix-dialog .erp-control,.erp-dialog.erp-matrix-dialog .erp-button{border-radius:3px}");
  });

  test("separates day pairs and employee blocks with stronger structural borders", () => {
    expect(matrixCss).toContain(".erp-month-day-head { border-right:2px solid var(--color-border-strong) !important; }");
    expect(matrixCss).toContain(".erp-month-value-cell { padding:0 !important; text-align:right; border-right:2px solid var(--color-border-strong) !important; }");
    expect(matrixCss).toContain(".erp-month-matrix-table tbody tr.erp-month-group-end td { border-bottom:2px solid var(--color-border-strong); }");
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-missing { background:var(--color-warning-soft) !important; }");
  });

  test("uses the page as the only vertical scroller on narrow screens", () => {
    expect(matrixCss).toMatch(/@media \(max-width: 767px\)[\s\S]*\.erp-month-matrix-scroll\s*\{\s*max-height:none;/);
  });
});
