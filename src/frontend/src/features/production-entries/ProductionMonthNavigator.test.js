import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionMonthNavigator } from "./ProductionMonthNavigator.jsx";

describe("ProductionMonthNavigator", () => {
  test("uses labeled month navigation buttons", () => {
    const html = renderToStaticMarkup(<ProductionMonthNavigator monthKey="2026-08" />);

    expect(html).toContain("Tháng trước");
    expect(html).toContain("Tháng sau");
    expect(html).toContain("erp-production-month-nav-button");
  });
});
