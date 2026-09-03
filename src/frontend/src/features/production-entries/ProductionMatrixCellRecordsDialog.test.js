import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionMatrixCellRecordsDialog } from "./ProductionMatrixCellRecordsDialog.jsx";

describe("ProductionMatrixCellRecordsDialog", () => {
  test("renders Vietnamese entry-mode labels for multiple records", () => {
    const context = {
      workDate: "2026-08-27",
      employee: { employeeName: "Bạch Thị Đào" },
      order: { orderCode: "0417" },
      operation: { operationNumber: 4 },
      cell: {
        entryCount: 2,
        records: [
          { id: "r1", entryMode: "Direct", hcQuantity: 100, tcQuantity: 10, totalQuantity: 110 },
          { id: "r2", entryMode: "ByShift", hcQuantity: 80, tcQuantity: 20, totalQuantity: 100 },
        ],
      },
    };

    const html = renderToStaticMarkup(<ProductionMatrixCellRecordsDialog context={context} />);
    expect(html).toContain("HC / TC trực tiếp");
    expect(html).toContain("Theo ca");
    expect(html).not.toContain(">Direct<");
    expect(html).not.toContain(">ByShift<");
  });
});
