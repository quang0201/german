import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ProductionEntryFormPage attendance defaults", () => {
  test("loads attendance hours for new entries and sends editable HC hours to backend", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryFormPage.jsx"), "utf8");

    expect(source).toContain("/api/lookups/attendance-hours");
    expect(source).toContain("regularHours");
    expect(source).toContain("overtimeHours");
    expect(source).toContain("hcHours:");
  });

  test("does not use attendance autofill while editing a saved production entry", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryFormPage.jsx"), "utf8");

    expect(source).toContain("if (editing)");
    expect(source).toContain("attendanceHoursDefaults");
    expect(source).toContain("entry?.hcHours");
  });

  test("resets both hour fields when saving and entering the next record", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionEntryFormPage.jsx"), "utf8");

    expect(source).toContain("setHcHours(\"0\")");
    expect(source).toContain("overtimeHours: entry?.overtimeHours ?? \"0\"");
    expect(source).toContain("shift1Quantity: entry?.shift1Quantity ?? \"0\"");
    expect(source).toContain("directHcQuantity: entry?.directHcQuantity ?? \"0\"");
    expect(source).toContain("totalQuantity: entry?.totalInputQuantity ?? \"0\"");
    expect(source).toContain("setAttendanceLookupVersion");
  });
});
