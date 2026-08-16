import { describe, expect, test } from "bun:test";
import { buildAttendanceSavePayload, calculateDraftTotals, mergeAttendanceEmployees, parseAttendanceCell } from "./attendanceModel.js";

describe("attendance model", () => {
  test("parses hours, leave codes and blank cells without accepting X", () => {
    expect(parseAttendanceCell("4")).toEqual({ kind: "Hours", workedHours: 4 });
    expect(parseAttendanceCell("3,5")).toEqual({ kind: "Hours", workedHours: 3.5 });
    expect(parseAttendanceCell("p")).toEqual({ kind: "PaidLeave", workedHours: null });
    expect(parseAttendanceCell("ô")).toEqual({ kind: "SickLeave", workedHours: null });
    expect(parseAttendanceCell("")).toEqual({ kind: "Empty", workedHours: null });
    expect(() => parseAttendanceCell("X")).toThrow();
  });

  test("builds one save day with regular slots and daily overtime", () => {
    const data = {
      employees: [{
        employeeId: "e1",
        days: [{
          workDate: "2026-08-16",
          hasAttendance: false,
          hasShiftSetup: true,
          overtimeHours: 0,
          shifts: [
            { slotNumber: 1, scheduledHours: 4, valueKind: "Empty", workedHours: null },
            { slotNumber: 2, scheduledHours: 4, valueKind: "Empty", workedHours: null },
          ],
        }],
      }],
    };
    const payload = buildAttendanceSavePayload(data, {
      "e1|2026-08-16": { overtimeHours: "2", shifts: { 1: "4", 2: "P" } },
    }, 2026, 8, new Set(["e1|2026-08-16"]));
    expect(payload.days[0]).toEqual({
      employeeId: "e1",
      workDate: "2026-08-16",
      overtimeHours: 2,
      shifts: [
        { slotNumber: 1, kind: "Hours", workedHours: 4 },
        { slotNumber: 2, kind: "PaidLeave", workedHours: null },
      ],
    });
  });

  test("calculates local draft totals from dynamic slots", () => {
    const employee = {
      employeeId: "e1",
      days: [{
        workDate: "2026-08-16",
        shifts: [
          { slotNumber: 1, scheduledHours: 4 },
          { slotNumber: 2, scheduledHours: 4 },
        ],
      }],
    };
    expect(calculateDraftTotals(employee, {
      "e1|2026-08-16": { overtimeHours: "2", shifts: { 1: "3", 2: "P" } },
    })).toEqual({ regularWorkedHours: 3, overtimeHours: 2, paidLeaveHours: 4, sickLeaveHours: 0 });
  });

  test("saves only dirty employee-days instead of every configured day", () => {
    const day = (workDate) => ({
      workDate,
      hasAttendance: false,
      hasShiftSetup: true,
      overtimeHours: 0,
      shifts: [{ slotNumber: 1, scheduledHours: 4, valueKind: "Empty", workedHours: null }],
    });
    const data = { employees: [
      { employeeId: "e1", days: [day("2026-08-16"), day("2026-08-17")] },
      { employeeId: "e2", days: [day("2026-08-16"), day("2026-08-17")] },
    ] };
    const drafts = {
      "e1|2026-08-16": { overtimeHours: "", shifts: { 1: "4" } },
      "e1|2026-08-17": { overtimeHours: "", shifts: { 1: "" } },
      "e2|2026-08-16": { overtimeHours: "", shifts: { 1: "" } },
      "e2|2026-08-17": { overtimeHours: "", shifts: { 1: "" } },
    };
    const payload = buildAttendanceSavePayload(data, drafts, 2026, 8, new Set(["e1|2026-08-16"]));
    expect(payload.days).toHaveLength(1);
    expect(payload.days[0].employeeId).toBe("e1");
    expect(payload.days[0].workDate).toBe("2026-08-16");
  });

  test("merges a loaded employee batch without dropping existing drafts", () => {
    expect(mergeAttendanceEmployees(
      [{ employeeId: "e1", fullName: "Một" }, { employeeId: "e2", fullName: "Hai" }],
      [{ employeeId: "e2", fullName: "Hai updated" }, { employeeId: "e3", fullName: "Ba" }],
    )).toEqual([
      { employeeId: "e1", fullName: "Một" },
      { employeeId: "e2", fullName: "Hai updated" },
      { employeeId: "e3", fullName: "Ba" },
    ]);
  });
});
