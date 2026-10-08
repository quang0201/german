import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const matrixCss = readFileSync(new URL("./ProductionMonthlyMatrix.css", import.meta.url), "utf8");
const dialogsCss = readFileSync(new URL("./ProductionMatrixDialogs.css", import.meta.url), "utf8");
const appCss = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("ProductionMonthlyMatrix responsive CSS", () => {
  test("covers fractional viewport widths at mobile and tablet breakpoints", () => {
    expect(appCss).toContain("@media (max-width: 767.98px)");
    expect(appCss).toContain("@media (min-width: 768px) and (max-width: 1023.98px)");
    expect(appCss).toContain("@media (max-width: 1023.98px)");
    const tabletRules = appCss.match(/@media \(min-width: 768px\) and \(max-width: 1023\.98px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(tabletRules).toMatch(/\.erp-mobile-menu\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
  });

  test("keeps production entry dialogs within the viewport with internal scrolling", () => {
    expect(dialogsCss).toContain(".erp-dialog.erp-matrix-dialog,.erp-dialog.erp-matrix-batch-dialog{max-height:calc(100dvh - 32px); overflow-y:auto; overscroll-behavior:contain;");
  });

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
    expect(matrixCss).toContain(".erp-month-matrix-table thead tr:first-child th { top:0; height:46px;");
    expect(matrixCss).not.toContain("thead tr:nth-child(2)");
  });

  test("keeps sticky total headers aligned with the single date header row", () => {
    expect(matrixCss).toMatch(/\.erp-month-matrix-table thead \.erp-month-total[\s\S]*z-index:\s*12/);
  });

  test("aligns row-spanned employee names with the first operation row", () => {
    expect(matrixCss).toMatch(/\.erp-month-employee[\s\S]*vertical-align:\s*top[\s\S]*padding-top:\s*10px\s*!important/);
    expect(matrixCss).toContain("--erp-month-employee-column-width:14ch;");
    expect(matrixCss).toContain(".erp-month-employee-name { display:-webkit-box;");
    expect(matrixCss).toContain("-webkit-line-clamp:2;");
    expect(matrixCss).toContain("overflow-wrap:anywhere;");
  });

  test("gives the single sticky header row enough height for the date and total", () => {
    expect(matrixCss).toContain(".erp-month-matrix-table thead tr:first-child th { top:0; height:46px; vertical-align:middle; }");
  });

  test("marks Sunday headers red and today's header blue without heavy fills", () => {
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-sunday[\s\S]*background:/);
    expect(matrixCss).toContain(".erp-month-day-head.erp-month-sunday { background:color-mix(in srgb, var(--color-error-soft) 35%, var(--color-surface)); color:var(--color-error); box-shadow:inset 0 -1px 0 var(--color-border-strong); }");
    expect(matrixCss).toContain(".erp-month-day-head.erp-month-today { background:var(--color-surface-soft); color:var(--color-info); box-shadow:inset 0 -2px 0 var(--color-info); }");
    expect(matrixCss).toContain(".erp-month-day-head.erp-month-sunday.erp-month-today { color:var(--color-info); }");
    expect(matrixCss).toContain(".erp-month-day-head.erp-month-sunday.erp-month-today span { color:var(--color-error); }");
    expect(matrixCss).toContain(".erp-month-matrix-table thead th.erp-month-hover-day { background:color-mix(in srgb, var(--color-border-strong) 24%, var(--color-surface)) !important; color:var(--color-text) !important; box-shadow:inset 0 -3px 0 var(--color-border-strong); }");
  });

  test("separates employee groups and gives blank status cells a non-color marker", () => {
    expect(matrixCss).toContain("erp-month-matrix-table tbody tr.erp-month-group-end td");
    expect(matrixCss).not.toContain("erp-month-group-alt");
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-no-attendance button:empty::after { content:"?"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-missing button:empty::after { content:"!"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-paid-leave button:empty::after { content:"P"');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-no-attendance button:not(:empty)::before { content:"? "');
    expect(matrixCss).toContain('erp-month-status-marker.erp-month-paid-leave button:not(:empty)::before { content:"P "');
    expect(matrixCss).toContain("border-right:1px solid var(--color-border); border-bottom:1px solid var(--color-border);");
  });

  test("uses a stronger cell grid and one status accent per daily total", () => {
    expect(matrixCss).toContain("border-right:1px solid var(--color-border);");
    expect(matrixCss).toContain("erp-month-status-marker.erp-month-no-attendance { box-shadow:inset 3px 0");
    expect(matrixCss).toContain(".erp-month-value-cell { min-width:var(--erp-month-day-column-width); width:var(--erp-month-day-column-width);");
  });

  test("keeps future blank cells neutral and explains that state in the legend", () => {
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-future");
    expect(matrixCss).toContain(".is-future-date");
  });

  test("makes date and cell entry affordances visible without hover", () => {
    expect(matrixCss).toContain(".erp-month-day-head button { display:grid;");
    expect(matrixCss).toContain("color:inherit; cursor:pointer;");
    expect(matrixCss).toContain(".erp-month-value-cell button:empty::after { content:\"\";");
    expect(matrixCss).toContain(".erp-month-value-cell button:empty:hover::after, .erp-month-value-cell button:empty:focus-visible::after { content:\"+\";");
    expect(matrixCss).toContain(".erp-month-matrix-help");
  });

  test("uses clear gridlines and tracks the hovered cell's employee row and date column", () => {
    expect(matrixCss).toContain("border-right:1px solid var(--color-border); border-bottom:1px solid var(--color-border);");
    expect(matrixCss).toContain(".erp-month-hover-row > td:not(.erp-month-after-deactivation)");
    expect(matrixCss).toContain(".erp-month-hover-column");
    expect(matrixCss).toContain(".erp-month-hover-cell");
    expect(matrixCss).toContain(".erp-month-hover-day");
    expect(matrixCss).toContain(".erp-month-cell-tooltip { position:fixed;");
    expect(matrixCss).toContain("td.erp-month-hover-column { box-shadow:inset 1px 0 var(--color-border-strong), inset -1px 0 var(--color-border-strong); }");
    expect(matrixCss).toContain("td.erp-month-hover-cell { background-color:color-mix(in srgb, var(--color-border-strong) 24%, var(--color-surface)) !important; box-shadow:inset 0 0 0 2px var(--color-border-strong); }");
    expect(matrixCss).not.toContain("td.erp-month-hover-column { outline:");
  });

  test("uses legible semantic tints for warnings, missing attendance, and paid leave", () => {
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-missing { background:var(--color-warning-soft) !important; }");
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-no-attendance { background:var(--color-error-soft) !important; }");
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-paid-leave { background:var(--color-paid-leave-soft) !important; }");
  });

  test("uses restrained square corners for matrix controls and entry dialogs", () => {
    expect(matrixCss).toContain(".erp-month-day-head button:focus-visible");
    expect(matrixCss).not.toContain("erp-month-day-action");
    expect(matrixCss).toContain("border-left-width:3px; border-radius:3px; background:var(--color-surface);");
    expect(dialogsCss).toMatch(/\.erp-dialog\.erp-matrix-dialog,\.erp-dialog\.erp-matrix-batch-dialog\{[^}]*border-radius:4px\}/);
    expect(dialogsCss).toContain(".erp-dialog.erp-matrix-dialog .erp-mode-option,.erp-dialog.erp-matrix-dialog .erp-control,.erp-dialog.erp-matrix-dialog .erp-button{border-radius:3px}");
  });

  test("separates day pairs and employee blocks with stronger structural borders", () => {
    expect(matrixCss).toContain(".erp-month-day-head { border-right:2px solid var(--color-border-strong) !important; }");
    expect(matrixCss).toContain(".erp-month-value-cell { padding:0 !important; text-align:right; border-right:2px solid var(--color-border-strong) !important; }");
    expect(matrixCss).toContain(".erp-month-matrix-table tbody tr.erp-month-group-end td { border-bottom:2px solid var(--color-border-strong); }");
    expect(matrixCss).not.toContain(".erp-month-matrix-table tbody tr.erp-month-group-start td { border-top:2px solid var(--color-border-strong); }");
    expect(matrixCss).toContain(".erp-month-value-cell.erp-month-missing { background:var(--color-warning-soft) !important; }");
  });

  test("keeps normal matrix cells neutral and reserves the primary color for focus/actions", () => {
    expect(matrixCss).toContain("background-color:color-mix(in srgb, var(--color-border) 22%, var(--color-surface)) !important;");
    expect(matrixCss).toContain("td.erp-month-hover-cell { background-color:color-mix(in srgb, var(--color-border-strong) 24%, var(--color-surface)) !important; box-shadow:inset 0 0 0 2px var(--color-border-strong); }");
    expect(matrixCss).toContain(".erp-month-matrix-table thead .erp-month-total { z-index:12; background:var(--color-surface-soft) !important;");
    expect(matrixCss).not.toContain("background-color:color-mix(in srgb, var(--color-primary-soft) 58%");
  });

  test("uses balanced fixed widths for employee, operation, day, and total columns", () => {
    expect(matrixCss).toContain("--erp-month-employee-column-width:14ch;");
    expect(matrixCss).toContain("--erp-month-operation-column-width:64px;");
    expect(matrixCss).toContain("--erp-month-day-column-width:80px;");
    expect(matrixCss).toContain("--erp-month-total-column-width:88px;");
    expect(matrixCss).toContain("--erp-month-employee-column-width:13ch; --erp-month-operation-column-width:52px; --erp-month-day-column-width:80px;");
    expect(matrixCss).toContain("width:max-content; min-width:0;");
    expect(matrixCss).toContain(".erp-month-total { position:static;");
    expect(matrixCss).toContain(".erp-month-matrix-has-overflow .erp-month-total { position:sticky; }");
    expect(matrixCss).toContain("right:var(--erp-month-total-column-width);");
    expect(matrixCss).toContain("right:calc(var(--erp-month-total-column-width) + var(--erp-month-total-column-width));");
  });

  test("does not reserve an empty vertical scrollbar gutter around the matrix", () => {
    expect(matrixCss).toContain("scrollbar-gutter:auto;");
    expect(matrixCss).not.toContain("scrollbar-gutter:stable;");
  });

  test("scales and centers the matrix on wide desktop screens", () => {
    expect(matrixCss).toMatch(/@media \(min-width: 1440px\) and \(max-width: 1679px\)[\s\S]*font-size:15px/);
    expect(matrixCss).toMatch(/@media \(min-width: 1680px\)[\s\S]*--erp-month-day-column-width:clamp\(120px, calc\(\(100vw - 920px\) \/ 7\), 234px\)/);
    expect(matrixCss).toMatch(/@media \(min-width: 1680px\)[\s\S]*max-width:none/);
    expect(matrixCss).toMatch(/@media \(min-width: 1680px\)[\s\S]*margin-inline:auto/);
    expect(matrixCss).toMatch(/@media \(min-width: 1680px\)[\s\S]*font-size:16px/);
    expect(matrixCss).toMatch(/@media \(min-width: 1680px\)[\s\S]*height:clamp\(37px, calc\(6\.25dvh - 23px\), 68px\)/);
  });

  test("uses a compact vertical density on scaled desktop viewports", () => {
    expect(matrixCss).toMatch(/@media \(min-width: 1440px\) and \(max-height: 1200px\)[\s\S]*height:clamp\(37px, calc\(6\.25dvh - 23px\), 46px\)/);
    expect(matrixCss).toMatch(/@media \(min-width: 1680px\) and \(max-height: 1200px\)[\s\S]*height:44px/);
    expect(matrixCss).toMatch(/@media \(min-width: 1440px\) and \(max-height: 900px\)[\s\S]*height:28px/);
    expect(matrixCss).toMatch(/@media \(min-width: 1680px\) and \(max-height: 900px\)[\s\S]*height:28px/);
    expect(matrixCss).toMatch(/@media \(min-width: 1440px\) and \(max-height: 900px\)[\s\S]*height:44px/);
  });

  test("uses the page as the only vertical scroller on narrow screens", () => {
    expect(matrixCss).toMatch(/@media \(max-width: 767\.98px\)[\s\S]*\.erp-month-matrix-scroll\s*\{\s*max-height:none;/);
  });
});
