import { describe, expect, test } from "bun:test";
import { buildDemoWeeklyMatrix, demoEmployees } from "./mockData.mjs";

const week = {
  fromDate: "2026-09-28",
  untilDate: "2026-10-04",
};

describe("local matrix review data", () => {
  test("provides exactly 30 fictional production cells and excludes Sundays", () => {
    const result = buildDemoWeeklyMatrix(week);
    const cells = result.orders.flatMap((order) => order.employees.flatMap((employee) => employee.operations.flatMap((operation) => operation.cells)));

    expect(cells).toHaveLength(30);
    expect(result.summary.entryCount).toBe(30);
    expect(cells.every((cell) => cell.workDate !== "2026-10-04")).toBe(true);
    expect(result.availableOrders[0].code).toStartWith("DEMO-");
    expect(result.orders[0].employees.every((employee) => employee.employeeCode.startsWith("DEMO-"))).toBe(true);
  });

  test("includes HC/TC quantities, attendance exceptions, and an hourly-only employee", () => {
    const result = buildDemoWeeklyMatrix(week);
    const employees = result.orders[0].employees;
    const cells = employees.flatMap((employee) => employee.operations.flatMap((operation) => operation.cells));

    expect(cells.some((cell) => cell.hcQuantity > 0 && cell.tcQuantity > 0)).toBe(true);
    expect(result.summary.totalQuantity).toBe(result.summary.hcQuantity + result.summary.tcQuantity);
    expect(employees[1].workedDates).not.toContain("2026-10-03");
    expect(employees[2].paidLeaveDates).toContain("2026-10-02");
    expect(result.hourlyEmployees).toHaveLength(1);
    expect(result.hourlyEmployees[0].compensationType).toBe("Hourly");
  });
});
