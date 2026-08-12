import { describe, expect, test } from "bun:test";
import { getProductionEntryColumnKeys, getShellMode } from "./responsiveLayout.js";

describe("ERP responsive layout contract", () => {
  test("uses wide, compact, tablet and mobile shell modes at the locked breakpoints", () => {
    expect(getShellMode(1280)).toBe("wide");
    expect(getShellMode(1024)).toBe("compact");
    expect(getShellMode(768)).toBe("tablet");
    expect(getShellMode(639)).toBe("mobile");
  });

  test("prioritizes actionable production columns on mobile", () => {
    expect(getProductionEntryColumnKeys("Manager", "mobile")).toEqual([
      "workDate", "employeeCode", "productionOrderCode", "operationNumber", "totalQuantity", "actions",
    ]);
    expect(getProductionEntryColumnKeys("Worker", "mobile")).toEqual([
      "workDate", "productionOrderCode", "operationNumber", "totalQuantity", "actions",
    ]);
  });

  test("keeps the complete production table outside mobile", () => {
    expect(getProductionEntryColumnKeys("Manager", "tablet")).toContain("hcQuantity");
    expect(getProductionEntryColumnKeys("Manager", "wide")).toContain("entryMode");
  });
});
