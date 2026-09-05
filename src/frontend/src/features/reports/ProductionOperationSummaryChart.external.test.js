import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ProductionOperationSummaryChart } from "./ProductionOperationSummaryChart.jsx";

describe("ProductionOperationSummaryChart", () => {
  test("highlights an operation that exceeds the plan tolerance", () => {
    const html = renderToString(React.createElement(ProductionOperationSummaryChart, {
      plannedQuantity: 15000,
      summary: {
        orderCode: "0417",
        productName: "Túi 0417",
        operationCount: 1,
        operations: [{ operationNumber: 1, name: "Cắt quai", unit: "cái", hcQuantity: 15101, tcQuantity: 0, totalQuantity: 15101 }],
      },
    }));

    expect(html).toContain("erp-report-operation-row is-over-plan");
    expect(html).toContain("Vượt kế hoạch");
    expect(html).toContain("Kế hoạch 15.000");
  });

  test("renders every operation in one horizontal table and keeps the stacked quantities", () => {
    const html = renderToString(React.createElement(ProductionOperationSummaryChart, {
      summary: {
        orderCode: "0417",
        productName: "Túi 0417",
        operationCount: 2,
        operations: [
          {
            operationNumber: 4,
            name: "May",
            unit: "cái",
            hcQuantity: 100,
            tcQuantity: 20,
            totalQuantity: 120,
            externalQuantity: 30,
            combinedTotalQuantity: 150,
          },
          {
            operationNumber: 5,
            name: "May lược túi trước với thân trước",
            unit: "cái",
            hcQuantity: 50,
            tcQuantity: 0,
            totalQuantity: 50,
            externalQuantity: 0,
            combinedTotalQuantity: 50,
          },
        ],
      },
    }));

    expect(html).toContain("Cơ cấu sản lượng");
    expect(html).toContain("Nội bộ");
    expect(html).toContain("Bên ngoài");
    expect(html).toContain("Tổng");
    expect(html).toContain("HC 100");
    expect(html).toContain("TC 20");
    expect(html).toContain("150 cái");
    expect(html).toContain("—");
    expect(html).toContain("erp-report-operation-bar-external");
    expect(html).toContain("style=\"width:20%\"");
    expect(html).not.toContain("Đơn vị:");
    expect(html).not.toContain("erp-report-operation-unit-group");
    expect(html).not.toContain("erp-report-operation-details");
    expect(html).toContain("CĐ4");
    expect(html).toContain("CĐ5");
  });
});
