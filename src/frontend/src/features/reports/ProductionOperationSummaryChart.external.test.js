import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ProductionOperationSummaryChart } from "./ProductionOperationSummaryChart.jsx";

describe("ProductionOperationSummaryChart external quantities", () => {
  test("renders external quantity in a stacked bar and combined total scale", () => {
    const html = renderToString(React.createElement(ProductionOperationSummaryChart, {
      summary: {
        orderCode: "0417",
        productName: "Túi 0417",
        operationCount: 1,
        operations: [{
          operationNumber: 4,
          name: "May",
          unit: "cái",
          hcQuantity: 100,
          tcQuantity: 20,
          totalQuantity: 120,
          externalQuantity: 30,
          combinedTotalQuantity: 150,
        }],
      },
    }));

    expect(html).toContain("Bên ngoài: 30");
    expect(html).toContain("Tổng: 150 cái");
    expect(html).toContain("erp-report-operation-bar-external");
    expect(html).toContain("style=\"width:20%\"");
  });
});
