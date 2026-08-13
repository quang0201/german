import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionMonthlyMatrix } from "./ProductionMonthlyMatrix.jsx";

describe("ProductionMonthlyMatrix", () => {
  test("renders one shared day axis, order block and rowspan employee", () => {
    const operation = (id, number, cells = []) => ({ operationId: id, operationNumber: number, operationName: `CĐ${number}`, hcQuantity: 100, tcQuantity: 20, totalQuantity: 120, cells });
    const data = {
      availableOrders: [{ id: "o1", code: "0417", productName: "Mã hàng 0417" }],
      orders: [{
        orderId: "o1", orderCode: "0417", productName: "Mã hàng 0417",
        employees: [{ employeeId: "e1", employeeCode: "E001", employeeName: "Bạch Thị Đào", operations: [operation("op1", 4), operation("op2", 5), operation("op3", 100)] }],
      }],
    };

    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);

    expect(html).toContain("Nhân viên");
    expect(html).toContain("CĐ");
    expect(html).toContain("T5");
    expect(html).toContain("27/08");
    expect(html).toContain("Mã SX: 0417");
    expect(html).toContain('rowspan="3"');
    expect(html).toContain("Tổng HC");
    expect(html).toContain("Tổng TC");
    expect(html).not.toContain(">ĐVT<");
    expect(html).not.toContain(">CN<");
  });
});
