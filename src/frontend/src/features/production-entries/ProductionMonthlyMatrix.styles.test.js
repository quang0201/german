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
});
