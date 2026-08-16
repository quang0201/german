import { describe, expect, test } from "bun:test";
import { attendanceDayBlocks, buildAttendanceSavePayload, buildAttendanceRenderData, calculateDisplayTotals, calculateDraftTotals, emptyAttendanceCache, isCurrentAttendanceRequest, mergeAttendanceCache, mergeAttendanceEmployees, parseAttendanceCell, patchAttendanceSave, setAttendanceBlockStatus, mergeAttendanceSaveDrafts } from "./attendanceModel.js";

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

  test("rejects stale batch and save responses after the month generation changes", () => {
    expect(isCurrentAttendanceRequest("2026-08", "2026-09", 1, 2)).toBe(false);
    expect(isCurrentAttendanceRequest("2026-08", "2026-08", 1, 2)).toBe(false);
    expect(isCurrentAttendanceRequest("2026-08", "2026-08", 2, 2)).toBe(true);
  });

  test("builds exactly three fixed day blocks with the correct final length", () => {
    expect(attendanceDayBlocks(2026, 2).map((block) => block.dayCount)).toEqual([10, 10, 8]);
    expect(attendanceDayBlocks(2028, 2).map((block) => block.dayCount)).toEqual([10, 10, 9]);
    expect(attendanceDayBlocks(2026, 4).map((block) => block.dayCount)).toEqual([10, 10, 10]);
    expect(attendanceDayBlocks(2026, 8).map((block) => block.dayCount)).toEqual([10, 10, 11]);
  });

  test("merges day rectangles without dropping earlier blocks", () => {
    const first = { year: 2026, month: 8, dayFrom: 1, dayTo: 10, nextEmployeeCursor: "next", employees: [{ employeeId: "e1", employeeCode: "E1", fullName: "An", totals: { regularWorkedHours: 4 }, days: [{ workDate: "2026-08-01", hasShiftSetup: true, shifts: [] }] }] };
    const second = { year: 2026, month: 8, dayFrom: 11, dayTo: 20, nextEmployeeCursor: null, employees: [{ employeeId: "e1", employeeCode: "E1", fullName: "An", totals: { regularWorkedHours: 8 }, days: [{ workDate: "2026-08-11", hasShiftSetup: true, shifts: [] }] }] };
    let cache = mergeAttendanceCache(emptyAttendanceCache("2026-08", 1), first, { batchId: "batch-0" });
    cache = mergeAttendanceCache(cache, second, { batchId: "batch-0" });
    const rendered = buildAttendanceRenderData(cache, "2026-08", [1, 11]);
    expect(rendered.employees[0].days.map((day) => day.workDate)).toEqual(["2026-08-01", "2026-08-11"]);
    expect(rendered.employees[0].totals.regularWorkedHours).toBe(8);
  });

  test("adds only the dirty delta to persisted monthly totals", () => {
    const employee = {
      employeeId: "e1",
      totals: { regularWorkedHours: 4, overtimeHours: 1, paidLeaveHours: 0, sickLeaveHours: 0 },
      loadedDays: [{ workDate: "2026-08-01", overtimeHours: 1, shifts: [{ slotNumber: 1, scheduledHours: 4, valueKind: "Hours", workedHours: 4 }] }],
    };
    const drafts = { "e1|2026-08-01": { overtimeHours: "2", shifts: { 1: "3" } } };
    expect(calculateDisplayTotals(employee, drafts)).toEqual({ regularWorkedHours: 3, overtimeHours: 2, paidLeaveHours: 0, sickLeaveHours: 0 });
  });

  test("patches saved days and totals without dropping other cached rectangles", () => {
    const first = { year: 2026, month: 8, dayFrom: 1, dayTo: 10, employees: [{ employeeId: "e1", employeeCode: "E1", fullName: "An", totals: { regularWorkedHours: 4 }, days: [{ workDate: "2026-08-01", hasShiftSetup: true, shifts: [] }] }] };
    const second = { year: 2026, month: 8, dayFrom: 11, dayTo: 20, employees: [{ employeeId: "e1", employeeCode: "E1", fullName: "An", totals: { regularWorkedHours: 4 }, days: [{ workDate: "2026-08-11", hasShiftSetup: true, shifts: [] }] }] };
    let cache = mergeAttendanceCache(emptyAttendanceCache("2026-08", 1), first, { batchId: "batch-0" });
    cache = mergeAttendanceCache(cache, second, { batchId: "batch-0" });
    const patched = patchAttendanceSave(cache, { employees: [{ employeeId: "e1", totals: { regularWorkedHours: 8 }, days: [{ ...first.employees[0].days[0], overtimeHours: 2 }] }] });
    expect(patched.employeesById.e1.totals.regularWorkedHours).toBe(8);
    expect(patched.blocks["1|batch-0|11"].daysByEmployee.e1[0].workDate).toBe("2026-08-11");
    expect(patched.blocks["1|batch-0|1"].daysByEmployee.e1[0].overtimeHours).toBe(2);
  });

  test("preserves batch and day metadata when a block enters error state", () => {
    const cache = emptyAttendanceCache("2026-08", 1);
    const updated = setAttendanceBlockStatus(cache, "1|batch-1|11", "error", "failed", { batchId: "batch-1", dayFrom: 11 });
    expect(updated.blocks["1|batch-1|11"]).toMatchObject({ batchId: "batch-1", dayFrom: 11, status: "error", error: "failed" });
  });

  test("keeps a newer draft dirty when save response belongs to an older revision", () => {
    const key = "e1|2026-08-16";
    const drafts = { [key]: { overtimeHours: "", shifts: { 1: "3" } } };
    const result = { employees: [{ employeeId: "e1", days: [{ workDate: "2026-08-16", hasShiftSetup: true, shifts: [{ slotNumber: 1, valueKind: "Hours", workedHours: 4 }] }] }] };
    const merged = mergeAttendanceSaveDrafts(drafts, result, { [key]: 1 }, { [key]: 2 });
    expect(merged.drafts[key].shifts[1]).toBe("3");
    expect(merged.acknowledgedKeys).toEqual([]);
  });

  test("acknowledges a save response when the day revision is unchanged", () => {
    const key = "e1|2026-08-16";
    const result = { employees: [{ employeeId: "e1", days: [{ workDate: "2026-08-16", hasShiftSetup: true, shifts: [{ slotNumber: 1, valueKind: "Hours", workedHours: 4 }] }] }] };
    const merged = mergeAttendanceSaveDrafts({ [key]: { overtimeHours: "", shifts: { 1: "3" } } }, result, { [key]: 1 }, { [key]: 1 });
    expect(merged.drafts[key].shifts[1]).toBe("4");
    expect(merged.acknowledgedKeys).toEqual([key]);
  });
});
