import { describe, expect, test } from "bun:test";
import { firstActiveEmployeeId } from "./ProductionMatrixBatchEntryDialog.jsx";

describe("ProductionMatrixBatchEntryDialog helpers", () => {
  test("defaults to the first active employee instead of an inactive first row", () => {
    expect(firstActiveEmployeeId([
      { id: "inactive-1", isActive: false },
      { id: "active-1", isActive: true },
      { id: "active-2", isActive: true },
    ])).toBe("active-1");
    expect(firstActiveEmployeeId([{ id: "active-default" }])).toBe("active-default");
    expect(firstActiveEmployeeId([{ id: "inactive-only", isActive: false }])).toBe("");
  });
});
