import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCurrentAttendanceRequest, mergeAttendanceHourDraft, resolveBatchEntryQuantities } from "./productionMatrixBatch.js";

describe("production matrix batch attendance", () => {
  test("ignores attendance responses for an obsolete employee or day", () => {
    expect(isCurrentAttendanceRequest(false, "employee-a", "2026-08-01", "employee-a", "2026-08-01")).toBe(false);
    expect(isCurrentAttendanceRequest(true, "employee-a", "2026-08-01", "employee-b", "2026-08-01")).toBe(false);
    expect(isCurrentAttendanceRequest(true, "employee-a", "2026-08-01", "employee-a", "2026-08-02")).toBe(false);
    expect(isCurrentAttendanceRequest(true, "employee-a", "2026-08-01", "employee-a", "2026-08-01")).toBe(true);
  });

  test("wires dynamic attendance shifts into the batch dialog", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionMatrixBatchEntryDialog.jsx"), "utf8");

    expect(source).toContain("/api/lookups/attendance-hours");
    expect(source).toContain("Theo ca chấm công");
    expect(source).toContain('useState("attendance-shifts")');
    expect(source).toContain("resolveBatchEntryQuantities");
    expect(source).toContain("/api/production-entries/batch-direct");
  });

  test("builds Direct quantities from total-hours and attendance-shift modes", () => {
    const hourDraft = {
      hcHours: "8",
      tcHours: "2",
      shifts: [
        { slotNumber: 1, shiftName: "Ca 1", workedHours: "4" },
        { slotNumber: 2, shiftName: "Ca 2", workedHours: "4" },
      ],
    };

    expect(resolveBatchEntryQuantities({ mode: "total-hours", draft: { total: "1000" }, hourDraft }))
      .toMatchObject({ hc: 800, tc: 200 });
    expect(resolveBatchEntryQuantities({ mode: "attendance-shifts", draft: { total: "1000" }, hourDraft }))
      .toMatchObject({ hc: 800, tc: 200 });
  });

  test("keeps edited attendance fields while applying returned shift structure", () => {
    const merged = mergeAttendanceHourDraft(
      {
        hcHours: "",
        tcHours: "2",
        shifts: [],
      },
      {
        hasAttendance: true,
        regularHours: 8,
        overtimeHours: 1,
        shifts: [
          { slotNumber: 1, shiftName: "Ca 1", workedHours: 4 },
          { slotNumber: 2, shiftName: "Ca 2", workedHours: 4 },
        ],
      },
      { hcHours: false, tcHours: true, shifts: {} },
    );

    expect(merged.hcHours).toBe("8");
    expect(merged.tcHours).toBe("2");
    expect(merged.shifts).toHaveLength(2);
    expect(merged.shifts.map((shift) => shift.workedHours)).toEqual(["4", "4"]);
  });

  test("keeps an edited shift value while loading untouched shifts", () => {
    const merged = mergeAttendanceHourDraft(
      {
        hcHours: "8",
        tcHours: "1",
        shifts: [{ slotNumber: 1, workedHours: "6" }],
      },
      {
        hasAttendance: true,
        regularHours: 8,
        overtimeHours: 1,
        shifts: [
          { slotNumber: 1, shiftName: "Ca 1", workedHours: 4 },
          { slotNumber: 2, shiftName: "Ca 2", workedHours: 4 },
        ],
      },
      { hcHours: false, tcHours: false, shifts: { "1": true } },
    );

    expect(merged.shifts.map((shift) => shift.workedHours)).toEqual(["6", "4"]);
  });
});
