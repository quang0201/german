import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./ProductionMonthlyMatrix.css", import.meta.url), "utf8");

describe("ProductionMonthlyMatrix responsive CSS", () => {
  test("releases sticky-right totals when the viewport is too narrow", () => {
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.erp-month-total-all[\s\S]*right:\s*auto/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*tbody \.erp-month-total[\s\S]*position:\s*static/);
  });
});
