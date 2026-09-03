import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ProductionMonthlyReportPage } from "./ProductionMonthlyReportPage.jsx";
import { buildProductionMonthlySummaryUrl, monthRangeToDateRange } from "./productionMonthlyReport.js";

describe("ProductionMonthlyReportPage", () => {
  test("keeps month filters on the dedicated monthly report screen", () => {
    const html = renderToString(React.createElement(ProductionMonthlyReportPage));

    expect(html).toContain("Báo cáo theo tháng");
    expect(html).toContain("Từ tháng");
    expect(html).toContain("Đến tháng");
    expect(html).toContain('type="month"');
    expect(html).toContain("theo từng công đoạn");
  });

  test("builds a month-scoped summary URL without changing the daily report contract", () => {
    expect(buildProductionMonthlySummaryUrl("order-1", "2026-07", "2026-08")).toBe(
      "/api/reports/production/monthly-summary?orderId=order-1&fromMonth=2026-07&untilMonth=2026-08",
    );
    expect(monthRangeToDateRange("2026-07", "2026-08")).toEqual({ fromDate: "2026-07-01", untilDate: "2026-08-31" });
  });
});
