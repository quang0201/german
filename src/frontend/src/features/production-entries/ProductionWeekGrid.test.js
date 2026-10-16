import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionWeekGrid } from "./ProductionWeekGrid.jsx";

const op = (id, number, unit, cells = []) => ({ operationId: id, operationNumber: number, operationName: `CĐ${number}`, unit, hcQuantity: 0, tcQuantity: 0, totalQuantity: 0, cells });
const data = {
  orders: [{ orderId: "o1", orderCode: "4004 đen", productName: "Túi đen", employees: [
    { employeeId: "e1", employeeCode: "NV001", employeeName: "Nguyễn Thị Lan", isActive: true, compensationType: "PieceRate",
      operations: [op("d1", 1, "cái", [{ workDate: "2026-10-12", hcQuantity: 100, tcQuantity: 20, totalQuantity: 120, entryCount: 1, records: [] }])],
      productionDates: ["2026-10-12"], workedDates: ["2026-10-12", "2026-10-13"], paidLeaveDates: [] },
  ] }],
  hourlyEmployees: [],
  attendanceOnlyEmployees: [{ employeeId: "p1", employeeCode: "5", employeeName: "Trần Thị Loan", isActive: true, compensationType: "PieceRate", workedDates: ["2026-10-14"], paidLeaveDates: ["2026-10-12"] }],
};
const render = (props = {}) => renderToStaticMarkup(React.createElement(ProductionWeekGrid, { data, fromDate: "2026-10-12", untilDate: "2026-10-18", today: new Date("2026-10-16T09:00:00"), ...props }));

describe("ProductionWeekGrid", () => {
  test("lays the week out like the Excel export: fixed columns, one-line day headers, HC/TC/Tổng per day", () => {
    const html = render();
    for (const label of ["Nhân viên", "Mã SX", "CĐ", "ĐVT", "T2 12/10", "CN 18/10", "Cả tuần", "TỔNG"]) expect(html).toContain(label);
    expect(html).not.toContain("tháng 10");
    expect(html.match(/erp-week-sub is-hc/g)?.length).toBe(8);
    expect(html).toContain(">120<");
    expect(html).toContain(">cái<");
  });

  test("shows people who only have attendance, with leave and missing days", () => {
    const html = render();
    expect(html).toContain("Trần Thị Loan");
    expect(html).toContain("Chưa nhập");
    expect(html).toContain("is-leave");
    expect(html).toContain("is-missing");
  });

  test("the first day has no separator of its own; later days do", () => {
    const html = render();
    expect(html).toMatch(/class="erp-week-day (?!is-day-start)[^"]*"[^>]*><button[^>]*>T2 12\/10/);
    expect(html).toMatch(/class="erp-week-day is-day-start[^"]*"[^>]*><button[^>]*>T3 13\/10/);
  });

  test("compact mode keeps only one Tổng column per day", () => {
    const html = render({ compact: true });
    expect(html.match(/erp-week-sub is-hc/g)?.length).toBe(1);
    expect(html).toContain("is-compact");
  });

  test("an empty week explains what to do", () => {
    expect(render({ data: { orders: [], hourlyEmployees: [], attendanceOnlyEmployees: [] } })).toContain("Tuần này chưa có sản lượng hay chấm công");
  });
});
