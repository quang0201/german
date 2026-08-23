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

  test("uses a red weekend header and keeps today's header visually stronger", () => {
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-sunday[\s\S]*background:/);
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-sunday[\s\S]*color:/);
    expect(matrixCss).toMatch(/\.erp-month-day-head\.erp-month-today[\s\S]*background:/);
  });
});
