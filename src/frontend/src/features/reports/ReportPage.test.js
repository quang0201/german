import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { ReportPage, buildProductionReportExportUrl, buildProductionReportSummaryUrl, buildProductionMonthlySummaryUrl, currentReportMonthRange } from "./ReportPage.jsx";
import { ProductionOperationSummaryChart } from "./ProductionOperationSummaryChart.jsx";

describe("ReportPage", () => {
  test("defaults report dates to the current calendar month", () => {
    expect(currentReportMonthRange(new Date(2026, 7, 14))).toEqual({ fromDate: "2026-08-01", untilDate: "2026-08-31" });
    expect(currentReportMonthRange(new Date(2028, 1, 14))).toEqual({ fromDate: "2028-02-01", untilDate: "2028-02-29" });
  });

  test("renders the report controls inside the ERP feedback provider", () => {
    const html = renderToString(React.createElement(ToastProvider, null, React.createElement(ReportPage)));
    expect(html).toContain("Báo cáo");
    expect(html).toContain("Xuất Excel");
  });

  test("builds a stable export URL from the selected date range", () => {
    expect(buildProductionReportExportUrl("2026-08-01", "2026-08-12")).toBe(
      "/api/reports/production/export.xlsx?fromDate=2026-08-01&untilDate=2026-08-12",
    );
    expect(typeof api.download).toBe("function");
  });

  test("renders the production order selector and operation summary details", () => {
    const pageHtml = renderToString(React.createElement(ToastProvider, null, React.createElement(ReportPage)));
    expect(pageHtml).toContain("Chọn Mã SX");

    const chartHtml = renderToString(React.createElement(ProductionOperationSummaryChart, {
      summary: {
        orderCode: "0417",
        productName: "Túi 0417",
        operationCount: 2,
        operations: [
          { operationNumber: 11, name: "May thân", unit: "cái", hcQuantity: 80, tcQuantity: 20, totalQuantity: 100 },
          { operationNumber: 12, name: "Đóng gói", unit: "thùng", hcQuantity: 0, tcQuantity: 0, totalQuantity: 0 },
        ],
      },
    }));

    expect(chartHtml).toContain("0417");
    expect(chartHtml).toContain("Túi 0417");
    expect(chartHtml).toContain("CĐ");
    expect(chartHtml).toContain("HC: ");
    expect(chartHtml).toContain("TC: ");
    expect(chartHtml).toContain("Tổng:");
    expect(chartHtml).toContain("cái");
    expect(chartHtml).toContain("thùng");
  });

  test("builds a summary URL scoped to the selected order and date range", () => {
    expect(buildProductionReportSummaryUrl("order-1", "2026-08-01", "2026-08-10")).toBe(
      "/api/reports/production/summary?orderId=order-1&fromDate=2026-08-01&untilDate=2026-08-10",
    );
  });

  test("builds a monthly summary URL from the selected month range", () => {
    expect(buildProductionMonthlySummaryUrl("order-1", "2026-07", "2026-08")).toBe(
      "/api/reports/production/monthly-summary?orderId=order-1&fromMonth=2026-07&untilMonth=2026-08",
    );
  });

  test("groups operation bars by unit and scales each unit independently", () => {
    const chartHtml = renderToString(React.createElement(ProductionOperationSummaryChart, {
      summary: {
        orderCode: "0417",
        productName: "Túi 0417",
        operationCount: 2,
        operations: [
          { operationNumber: 11, name: "May thân", unit: "cái", hcQuantity: 1000, tcQuantity: 0, totalQuantity: 1000 },
          { operationNumber: 12, name: "Đóng gói", unit: "thùng", hcQuantity: 50, tcQuantity: 0, totalQuantity: 50 },
        ],
      },
    }));

    expect(chartHtml).not.toContain("<h3>");
    expect(chartHtml).toContain('aria-label="Đơn vị: cái"');
    expect(chartHtml).toContain('aria-label="Đơn vị: thùng"');
    expect(chartHtml.match(/style=\"width:50%\"/g)?.length ?? 0).toBe(0);
    expect(chartHtml.match(/style=\"width:100%\"/g)?.length ?? 0).toBe(2);
    expect(chartHtml).toContain("1.000");
    expect(chartHtml).toContain("cái");
    expect(chartHtml).toContain("50");
    expect(chartHtml).toContain("thùng");
  });
});
