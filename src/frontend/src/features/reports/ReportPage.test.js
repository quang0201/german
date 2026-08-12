import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { ReportPage, buildProductionReportExportUrl } from "./ReportPage.jsx";

describe("ReportPage", () => {
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
});
