import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ProductionMonthlyOperationTable } from "./ProductionMonthlyOperationTable.jsx";

describe("ProductionMonthlyOperationTable", () => {
  test("renders each month and the accumulated total for every operation", () => {
    const html = renderToString(React.createElement(ProductionMonthlyOperationTable, {
      summary: {
        orderCode: "0417",
        productName: "Túi 0417",
        operationCount: 1,
        months: [
          { year: 2026, month: 7, monthKey: "2026-07" },
          { year: 2026, month: 8, monthKey: "2026-08" },
        ],
        operations: [{
          operationNumber: 9,
          name: "May thân",
          unit: "cái",
          months: [
            { monthKey: "2026-07", hcQuantity: 100, tcQuantity: 20, totalQuantity: 120, externalQuantity: 0, combinedTotalQuantity: 120 },
            { monthKey: "2026-08", hcQuantity: 40, tcQuantity: 10, totalQuantity: 50, externalQuantity: 30, combinedTotalQuantity: 80 },
          ],
          hcQuantity: 140,
          tcQuantity: 30,
          totalQuantity: 170,
          externalQuantity: 30,
          combinedTotalQuantity: 200,
        }],
      },
    }));

    expect(html).toContain("Tổng hợp theo tháng");
    expect(html).toContain("07/2026");
    expect(html).toContain("08/2026");
    expect(html).toContain("Tổng HC/TC");
    expect(html).toContain("CĐ");
    expect(html).toContain("9");
    expect(html).toContain("HC:");
    expect(html).toContain("100");
    expect(html).not.toContain("Nội bộ:");
    expect(html).not.toContain("Bên ngoài:");
    expect(html).toContain("140");
    expect(html).toContain("30");
    expect(html).toContain("cái");
  });

  test("renders zero values instead of dropping an operation without production", () => {
    const html = renderToString(React.createElement(ProductionMonthlyOperationTable, {
      summary: {
        months: [{ year: 2026, month: 7, monthKey: "2026-07" }],
        operations: [{
          operationNumber: 4,
          name: "Kiểm hàng",
          unit: "kiện",
          months: [{ monthKey: "2026-07", hcQuantity: 0, tcQuantity: 0, totalQuantity: 0, externalQuantity: 0, combinedTotalQuantity: 0 }],
          combinedTotalQuantity: 0,
        }],
      },
    }));

    expect(html).toContain("CĐ");
    expect(html).toContain("4");
    expect(html).toContain("HC:");
    expect(html).toContain("TC:");
    expect(html).toContain("0");
    expect(html).toContain("kiện");
  });
});
