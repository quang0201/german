import { expect, test } from "bun:test";
import { buildDailyProduction } from "./productionDailyModel.js";

const date = "2026-10-22";
const roster = [{ id: "e1", employeeCode: "1", fullName: "Thu", isActive: true }, { id: "e2", employeeCode: "2", fullName: "Quỳnh", isActive: true }];
const cell = { workDate: date, hcQuantity: 764, tcQuantity: 286, entryCount: 1, records: [{ id: "r" }] };
const data = { orders: [{ orderId: "o", orderCode: "4004 cam - T10", employees: [{ employeeId: "e1", employeeName: "Thu", employeeCode: "1", operations: [{ operationId: "op", operationNumber: 6, unit: "cái", cells: [cell] }] }] }] };
const attendance = [{ employeeId: "e1", days: [{ workDate: date, hasAttendance: true, overtimeHours: 3, shifts: [{ valueKind: "Hours", workedHours: 4 }, { valueKind: "Hours", workedHours: 4 }] }] }];

test("daily view joins output and attendance once per employee, preserving edit context", () => {
  const result = buildDailyProduction(data, date, attendance, roster); const thu = result.find((item) => item.employeeId === "e1"); const quynh = result.find((item) => item.employeeId === "e2");
  expect(thu).toMatchObject({ status: "complete", hcHours: 8, tcHours: 3 });
  expect(thu.lines[0]).toMatchObject({ hc: 764, tc: 286, total: 1050, order: { orderCode: "4004 cam - T10" }, operation: { operationId: "op" } });
  expect(quynh.status).toBe("empty");
});
test("never marks missing attendance as saved; other dates do not leak in", () => {
  expect(buildDailyProduction(data, date, [], roster).find((item) => item.employeeId === "e1").status).toBe("missing-attendance");
  expect(buildDailyProduction(data, "2026-10-21", attendance, roster)[0]).toMatchObject({ status: "empty", lines: [] });
});
test("attendance without output is actionable, and stored zero differs from an empty cell", () => {
  expect(buildDailyProduction({}, date, attendance, roster).find((item) => item.employeeId === "e1").status).toBe("missing-production");
  const zero = structuredClone(data);
  zero.orders[0].employees[0].operations[0].cells = [{ ...cell, hcQuantity: 0, tcQuantity: 0 }];
  expect(buildDailyProduction(zero, date, attendance, roster).find((item) => item.employeeId === "e1").lines[0].total).toBe(0);
});
test("omits employees before joining or after leaving, but preserves historical output", () => {
  const people = [{ ...roster[1], joinedDate: "2026-10-23" }, { id: "e3", fullName: "Nghỉ", isActive: false, deactivatedAt: date }];
  expect(buildDailyProduction({}, date, [], people)).toEqual([]);
  expect(buildDailyProduction(data, date, [], [{ ...roster[0], isActive: false, deactivatedAt: date }])[0].lines).toHaveLength(1);
});
test("partial leave is not a full-day leave; hourly attendance needs no production", () => {
  const partial = [{ employeeId: "e1", days: [{ workDate: date, hasAttendance: true, shifts: [{ valueKind: "PaidLeave" }, { valueKind: "Hours", workedHours: 4 }] }] }];
  expect(buildDailyProduction({}, date, partial, roster).find((item) => item.employeeId === "e1").status).toBe("missing-production");
  expect(buildDailyProduction({}, date, attendance, [{ ...roster[0], compensationType: "Hourly" }])[0].status).toBe("hourly");
});
