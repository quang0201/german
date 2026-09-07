import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionWeekNavigator } from "./ProductionWeekNavigator.jsx";

describe("ProductionWeekNavigator", () => {
  test("renders Monday-to-Sunday range navigation", () => {
    const html = renderToStaticMarkup(<ProductionWeekNavigator fromDate="2026-08-31" untilDate="2026-09-06" />);

    expect(html).toContain("Tuần trước");
    expect(html).toContain("31/08/2026 – 06/09/2026");
    expect(html).toContain("Tuần sau");
    expect(html).toContain("Điều hướng tuần sản lượng");
  });
});
