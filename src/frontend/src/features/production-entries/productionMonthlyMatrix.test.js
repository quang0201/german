import { describe, expect, test } from "bun:test";
import { monthLabel, shiftMonth } from "./productionMonthlyMatrix.js";

describe("production monthly matrix helpers", () => {
  test("shifts months", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-08")).toBe("08/2026");
  });
});
