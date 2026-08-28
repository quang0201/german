import { describe, expect, test } from "bun:test";
import { employeeVisibleForMonth } from "./employeeVisibility.js";

describe("employee month visibility", () => {
  test("keeps known inactive employees through their deactivation month and hides legacy inactive records", () => {
    const known = { isActive: false, deactivatedAt: "2026-08-20" };
    expect(employeeVisibleForMonth(known, "2026-07")).toBe(true);
    expect(employeeVisibleForMonth(known, "2026-08")).toBe(true);
    expect(employeeVisibleForMonth(known, "2026-09")).toBe(false);
    expect(employeeVisibleForMonth({ isActive: false, deactivatedAt: null }, "2026-08")).toBe(false);
    expect(employeeVisibleForMonth({ isActive: true, deactivatedAt: null }, "2026-09")).toBe(true);
  });
});
