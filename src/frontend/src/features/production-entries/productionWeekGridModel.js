import { isEmployeeReadOnlyOnDate, isFutureProductionDate } from "./productionMonthlyMatrix.js";

const num = (value) => Number(value || 0);
const byNatural = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });

function union(target, values) {
  for (const value of values ?? []) target.add(value);
}

/**
 * Turns the matrix API payload (orders → employees → operations) into the Excel-like week grid:
 * one block per employee, one line per (order, operation) they worked, plus hourly people and
 * people who only have attendance so far. Lines carry the original order/employee/operation objects,
 * so a click hands the entry dialogs the same context as before.
 */
export function buildWeekGrid(data) {
  const byEmployee = new Map();
  const ensure = (source, kind) => {
    const key = String(source.employeeId);
    let item = byEmployee.get(key);
    if (!item) {
      item = {
        ...source,
        kind,
        lines: [],
        productionDates: new Set(),
        workedDates: new Set(),
        paidLeaveDates: new Set(),
      };
      byEmployee.set(key, item);
    }
    union(item.productionDates, source.productionDates);
    union(item.workedDates, source.workedDates);
    union(item.paidLeaveDates, source.paidLeaveDates);
    return item;
  };

  const totalsByDate = {};
  const total = { hc: 0, tc: 0 };
  for (const order of data?.orders ?? []) {
    for (const employee of order.employees ?? []) {
      const item = ensure(employee, employee.compensationType === "Hourly" ? "hourly" : "production");
      for (const operation of employee.operations ?? []) {
        const cells = new Map((operation.cells ?? []).map((cell) => [cell.workDate, cell]));
        item.lines.push({ order, employee, operation, cells });
        for (const cell of operation.cells ?? []) {
          const day = (totalsByDate[cell.workDate] ??= { hc: 0, tc: 0 });
          day.hc += num(cell.hcQuantity);
          day.tc += num(cell.tcQuantity);
          total.hc += num(cell.hcQuantity);
          total.tc += num(cell.tcQuantity);
        }
      }
    }
  }
  for (const employee of data?.hourlyEmployees ?? []) ensure(employee, "hourly");
  for (const employee of data?.attendanceOnlyEmployees ?? []) ensure(employee, "pending");

  const employees = [...byEmployee.values()]
    .map((item) => ({
      ...item,
      lines: item.lines.sort((a, b) => byNatural(a.order.orderCode, b.order.orderCode) || num(a.operation.operationNumber) - num(b.operation.operationNumber)),
    }))
    .sort((a, b) => byNatural(a.employeeCode, b.employeeCode) || byNatural(a.employeeName, b.employeeName));
  return { employees, totalsByDate, total };
}

/**
 * What one day of one line (or of a person without lines) should show. "Worked but nothing entered"
 * is flagged on the person's first line only, so a person with many lines gets one "!" per day.
 */
export function weekGridDayStatus(employee, line, isoDate, todayIso, lineIndex = 0) {
  const cell = line?.cells?.get(isoDate) ?? null;
  if (cell) return { status: "value", cell };
  if (isEmployeeReadOnlyOnDate(employee, isoDate)) return { status: "locked", cell: null };
  if (isFutureProductionDate(isoDate, todayIso)) return { status: "future", cell: null };
  if (employee.paidLeaveDates?.has(isoDate)) return { status: "leave", cell: null };
  if (lineIndex === 0 && employee.kind !== "hourly" && employee.workedDates?.has(isoDate) && !employee.productionDates?.has(isoDate)) return { status: "missing", cell: null };
  return { status: "empty", cell: null };
}
