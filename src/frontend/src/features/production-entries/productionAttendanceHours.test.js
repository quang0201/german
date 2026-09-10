import { describe, expect, test } from "bun:test";
import { attendanceHoursDefaults } from "./productionAttendanceHours.js";

describe("production attendance hour autofill", () => {
  test("maps saved regular and overtime attendance hours to editable defaults", () => {
    expect(attendanceHoursDefaults({ hasAttendance: true, regularHours: 7.5, overtimeHours: 1.5 })).toEqual({
      hcHours: "7.5",
      tcHours: "1.5",
    });
  });

  test("defaults unsaved attendance hours to zero", () => {
    expect(attendanceHoursDefaults({ hasAttendance: false, regularHours: 8, overtimeHours: 2 })).toEqual({
      hcHours: "0",
      tcHours: "0",
    });
  });

  test("defaults hours to zero instead of autofilling an existing production record", () => {
    expect(attendanceHoursDefaults({ hasAttendance: true, regularHours: 7, overtimeHours: 2 }, true)).toEqual({
      hcHours: "0",
      tcHours: "0",
    });
  });
});
