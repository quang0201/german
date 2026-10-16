import { describe, expect, test } from "bun:test";
import { buildWeekGrid, weekGridDayStatus } from "./productionWeekGridModel.js";

const op = (id, number, cells = []) => ({ operationId: id, operationNumber: number, operationName: `CĐ${number}`, hcQuantity: 0, tcQuantity: 0, totalQuantity: 0, cells });
const cell = (workDate, hc, tc) => ({ workDate, hcQuantity: hc, tcQuantity: tc, totalQuantity: hc + tc, entryCount: 1, records: [] });

const data = {
  orders: [
    { orderId: "o2", orderCode: "4004 xanh", productName: "Túi xanh", employees: [
      { employeeId: "e1", employeeCode: "NV001", employeeName: "Lan", isActive: true, compensationType: "PieceRate", operations: [op("x1", 1, [cell("2026-10-12", 10, 2)])], productionDates: ["2026-10-12"], workedDates: ["2026-10-12", "2026-10-13"], paidLeaveDates: [] },
    ] },
    { orderId: "o1", orderCode: "4004 đen", productName: "Túi đen", employees: [
      { employeeId: "e1", employeeCode: "NV001", employeeName: "Lan", isActive: true, compensationType: "PieceRate", operations: [op("d2", 2), op("d1", 1, [cell("2026-10-12", 5, 0)])], productionDates: ["2026-10-14"], workedDates: ["2026-10-12", "2026-10-13"], paidLeaveDates: [] },
      { employeeId: "e10", employeeCode: "10", employeeName: "Nga", isActive: true, compensationType: "PieceRate", operations: [op("d1", 1)], productionDates: [], workedDates: [], paidLeaveDates: ["2026-10-13"] },
    ] },
  ],
  hourlyEmployees: [{ employeeId: "h1", employeeCode: "9", employeeName: "Thanh", isActive: true, compensationType: "Hourly", workedDates: ["2026-10-12"], paidLeaveDates: [] }],
  attendanceOnlyEmployees: [{ employeeId: "p1", employeeCode: "5", employeeName: "Loan", isActive: true, compensationType: "PieceRate", workedDates: ["2026-10-13"], paidLeaveDates: ["2026-10-12"] }],
};

describe("buildWeekGrid", () => {
  test("puts each employee once, with every order and operation they worked as lines sorted by order code then CĐ", () => {
    const grid = buildWeekGrid(data);
    expect(grid.employees.map((item) => item.employeeCode)).toEqual(["5", "9", "10", "NV001"]);
    const lan = grid.employees.find((item) => item.employeeId === "e1");
    expect(lan.lines.map((line) => `${line.order.orderCode}|CĐ${line.operation.operationNumber}`)).toEqual(["4004 đen|CĐ1", "4004 đen|CĐ2", "4004 xanh|CĐ1"]);
    expect([...lan.productionDates].sort()).toEqual(["2026-10-12", "2026-10-14"]);
  });

  test("keeps hourly people and people who only have attendance, marked by kind", () => {
    const grid = buildWeekGrid(data);
    expect(grid.employees.find((item) => item.employeeId === "h1")).toMatchObject({ kind: "hourly", lines: [] });
    expect(grid.employees.find((item) => item.employeeId === "p1")).toMatchObject({ kind: "pending", lines: [] });
  });

  test("sums HC and TC per day and for the whole week", () => {
    const grid = buildWeekGrid(data);
    expect(grid.totalsByDate["2026-10-12"]).toEqual({ hc: 15, tc: 2 });
    expect(grid.total).toEqual({ hc: 15, tc: 2 });
  });
});

describe("weekGridDayStatus", () => {
  const today = "2026-10-14";
  const lan = () => buildWeekGrid(data).employees.find((item) => item.employeeId === "e1");

  test("a value wins; otherwise future, paid leave, then 'worked but nothing entered'", () => {
    const employee = lan();
    const line = employee.lines[0];
    expect(weekGridDayStatus(employee, line, "2026-10-12", today).status).toBe("value");
    expect(weekGridDayStatus(employee, line, "2026-10-13", today).status).toBe("missing");
    expect(weekGridDayStatus(employee, line, "2026-10-15", today).status).toBe("future");
    const nga = buildWeekGrid(data).employees.find((item) => item.employeeId === "e10");
    expect(weekGridDayStatus(nga, nga.lines[0], "2026-10-13", today).status).toBe("leave");
  });

  test("'worked but nothing entered' is flagged once per person, on the first line only", () => {
    const employee = lan();
    expect(weekGridDayStatus(employee, employee.lines[0], "2026-10-13", today, 0).status).toBe("missing");
    expect(weekGridDayStatus(employee, employee.lines[1], "2026-10-13", today, 1).status).toBe("empty");
  });

  test("a day with output on another order is not 'missing'; hourly people are never 'missing'", () => {
    const employee = lan();
    expect(weekGridDayStatus(employee, employee.lines[1], "2026-10-12", today).status).toBe("empty");
    const hourly = buildWeekGrid(data).employees.find((item) => item.employeeId === "h1");
    expect(weekGridDayStatus(hourly, null, "2026-10-12", today).status).toBe("empty");
  });

  test("people who only have attendance show leave and missing days", () => {
    const loan = buildWeekGrid(data).employees.find((item) => item.employeeId === "p1");
    expect(weekGridDayStatus(loan, null, "2026-10-12", today).status).toBe("leave");
    expect(weekGridDayStatus(loan, null, "2026-10-13", today).status).toBe("missing");
  });
});
