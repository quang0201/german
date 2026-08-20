import { describe, expect, test } from "bun:test";
import { attendanceHoursDefaults } from "./productionAttendanceHours.js";

describe("production attendance hour autofill", () => {
  test("maps saved regular and overtime attendance hours to editable defaults", () => {
    expect(attendanceHoursDefaults({ hasAttendance: true, regularHours: 7.5, overtimeHours: 1.5 })).toEqual({
      hcHours: "7.5",
      tcHours: "1.5",
    });
  });

  test("leaves hours blank when attendance was not saved", () => {
    expect(attendanceHoursDefaults({ hasAttendance: false, regularHours: 8, overtimeHours: 2 })).toEqual({
      hcHours: "",
      tcHours: "",
    });
  });

  test("does not autofill an existing production record", () => {
    expect(attendanceHoursDefaults({ hasAttendance: true, regularHours: 7, overtimeHours: 2 }, true)).toEqual({
      hcHours: "",
      tcHours: "",
    });
  });
});
