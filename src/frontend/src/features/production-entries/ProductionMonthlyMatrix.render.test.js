import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionMonthlyMatrix } from "./ProductionMonthlyMatrix.jsx";

const matrixSource = readFileSync(new URL("./ProductionMonthlyMatrix.jsx", import.meta.url), "utf8");

const operation = (id, number, cells = []) => ({
  operationId: id,
  operationNumber: number,
  operationName: `CĐ${number}`,
  hcQuantity: 100,
  tcQuantity: 20,
  totalQuantity: 120,
  cells,
});

function dataWithOneOrder() {
  return {
    availableOrders: [{ id: "o1", code: "0417", productName: "Mã hàng 0417" }],
    orders: [{
      orderId: "o1",
      orderCode: "0417",
      productName: "Mã hàng 0417",
      employees: [{
        employeeId: "e1",
        employeeCode: "E001",
        employeeName: "Bạch Thị Đào",
        operations: [operation("op1", 4), operation("op2", 5), operation("op3", 100)],
      }],
    }],
  };
}

describe("ProductionMonthlyMatrix render", () => {
  test("renders one shared day axis, order block and rowspan employee", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithOneOrder()} monthKey="2026-08" excludeSundays />);

    expect(html).toContain("Nhân viên");
    expect(html).toContain("CĐ");
    expect(html).toContain("T5");
    expect(html).toContain("27/08");
    expect(html).toContain("Mã SX: 0417");
    expect(html).toContain('rowSpan="3"');
    expect(html).toContain("Tổng HC");
    expect(html).toContain("Tổng TC");
    expect(html).not.toContain(">ĐVT<");
    expect(html).not.toContain(">CN<");
    expect(html).toContain('aria-label="Nhập nhanh ngày T7 01/08: chọn Mã SX và công đoạn"');
    expect(html).toContain("erp-month-order-filter-button");
  });

  test("keeps a sole production order selectable so operation filtering can be enabled", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithOneOrder()} monthKey="2026-08" selectedOrderId="o1" excludeSundays />);

    expect(html).toContain(">Tất cả mã SX</button>");
    expect(html).toContain('aria-pressed="true">0417</button>');
  });

  test("keeps the calendar header visible for an empty month so batch entry remains reachable", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={{ availableOrders: [], orders: [] }} monthKey="2026-08" excludeSundays />);

    expect(html).toContain('data-date="2026-08-01"');
    expect(html).toContain("Bấm vào ngày phía trên để nhập nhanh nhiều công đoạn.");
  });

  test("restores the horizontal matrix position after a data refresh", () => {
    expect(matrixSource).toContain("useLayoutEffect");
    expect(matrixSource).toContain("scrollLeftRef.current");
    expect(matrixSource).toContain("scrollLeft = scrollLeftRef.current");
    expect(matrixSource).toContain("onScroll");
    expect(matrixSource).toContain("horizontalScrollRef");
    expect(matrixSource).toContain("erp-month-matrix-horizontal-scroll");
  });

  test("marks today and contains logic to jump to its column", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={dataWithOneOrder()}
      monthKey="2026-08"
      excludeSundays
      today={new Date("2026-08-20T08:00:00")}
    />);

    expect(html).toContain("erp-month-today");
    expect(matrixSource).toContain("todayIso");
    expect(matrixSource).toContain("offsetLeft");
  });

  test("marks Sundays separately while keeping today highlighted", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={dataWithOneOrder()}
      monthKey="2026-08"
      excludeSundays={false}
      today={new Date("2026-08-20T08:00:00")}
    />);

    expect(html).toMatch(/class="[^"]*erp-month-sunday[^"]*"[^>]*>[\s\S]*data-date="2026-08-02"/);
    expect(html).toMatch(/class="[^"]*erp-month-today[^"]*"[^>]*>[\s\S]*data-date="2026-08-20"/);
    expect(matrixSource).toContain("day.isSunday");
  });
});
