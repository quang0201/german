import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCurrentAttendanceRequest } from "./productionMatrixBatch.js";

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
    expect(source).toContain("calculateMultiShiftHourSplit");
    expect(source).toContain("/api/production-entries/batch-direct");
  });
});
