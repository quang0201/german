import { buildWeekGrid } from "./productionWeekGridModel.js";
import { isEmployeeReadOnlyOnDate } from "./productionMonthlyMatrix.js";

export function buildDailyProduction(data, date, attendance = [], roster = []) {
  const groups = new Map(buildWeekGrid(data).employees.map((employee) => [String(employee.employeeId), employee]));
  const people = new Map(roster.map((employee) => [String(employee.id), employee]));
  const attendanceById = new Map(attendance.map((employee) => [String(employee.employeeId), employee.days?.find((day) => day.workDate === date)]));
  const ids = new Set([...people.keys(), ...groups.keys()]);
  return [...ids].flatMap((id) => {
    const source = people.get(id);
    const group = groups.get(id);
    const employee = { ...group, ...source, employeeId: id, employeeCode: source?.employeeCode ?? group?.employeeCode, employeeName: source?.fullName ?? group?.employeeName };
    const lines = (group?.lines ?? []).flatMap((line) => {
      const cell = line.cells.get(date);
      if (!cell || !(cell.entryCount > 0 || cell.records?.length > 0)) return [];
      const hc = Number(cell.hcQuantity ?? 0), tc = Number(cell.tcQuantity ?? 0);
      return [{ ...line, cell, hc, tc, total: hc + tc }];
    });
    if (!lines.length && (employee.joinedDate > date || isEmployeeReadOnlyOnDate(employee, date))) return [];
    const day = attendanceById.get(id);
    const shifts = day?.shifts ?? [];
    const hasAttendance = Boolean(day?.hasAttendance);
    const hcHours = shifts.reduce((sum, shift) => sum + (shift.valueKind === "Hours" ? Number(shift.workedHours ?? 0) : 0), 0);
    const tcHours = Number(day?.overtimeHours ?? 0);
    const onLeave = hasAttendance && shifts.length > 0 && shifts.every((shift) => ["PaidLeave", "SickLeave"].includes(shift.valueKind));
    const status = lines.length ? (hasAttendance ? "complete" : "missing-attendance")
      : onLeave ? "leave" : hasAttendance ? (employee.compensationType === "Hourly" ? "hourly" : "missing-production") : "empty";
    return [{ ...employee, lines, hasAttendance, hcHours, tcHours, status }];
  }).sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName), "vi", { numeric: true }));
}
