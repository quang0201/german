import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendancePage } from "./AttendancePage.jsx";
import { AttendanceMonthlyMatrix } from "./AttendanceMonthlyMatrix.jsx";

describe("AttendancePage", () => {
  test("exposes monthly attendance controls and input rules", () => {
    const html = renderToStaticMarkup(<AttendancePage />);
    expect(html).toContain("Chấm công");
    expect(html).toContain("Lưu thay đổi");
    expect(html).toContain("Tất cả nhân viên");
    expect(html).toContain("Ô trống = chưa nhập");
  });

  test("renders dynamic regular shifts and one daily TC row", () => {
    const html = renderToStaticMarkup(<AttendanceMonthlyMatrix
      data={{ employees: [{ employeeId: "e1", employeeCode: "E1", fullName: "An", days: [{ workDate: "2026-08-16", hasShiftSetup: true, shifts: [{ slotNumber: 1, scheduledHours: 4 }, { slotNumber: 2, scheduledHours: 4 }] }] }] }}
      drafts={{ "e1|2026-08-16": { overtimeHours: "", shifts: { 1: "4", 2: "P" } } }}
      loading={false}
    />);
    expect(html).toContain("Ca 1");
    expect(html).toContain("Ca 2");
    expect(html).toContain(">TC<");
    expect(html).toContain('value="P"');
  });

  test("keeps regular shift rows dynamic per employee", () => {
    const html = renderToStaticMarkup(<AttendanceMonthlyMatrix
      data={{ employees: [
        { employeeId: "e1", employeeCode: "E1", fullName: "An", days: [{ workDate: "2026-08-16", hasShiftSetup: true, shifts: [{ slotNumber: 1, scheduledHours: 4 }] }] },
        { employeeId: "e2", employeeCode: "E2", fullName: "Bình", days: [{ workDate: "2026-08-16", hasShiftSetup: true, shifts: [{ slotNumber: 1, scheduledHours: 4 }, { slotNumber: 2, scheduledHours: 4 }] }] },
      ] }}
      drafts={{ "e1|2026-08-16": { overtimeHours: "", shifts: { 1: "" } }, "e2|2026-08-16": { overtimeHours: "", shifts: { 1: "", 2: "" } } }}
      loading={false}
    />);
    expect(html).not.toContain('aria-label="An Ca 2');
    expect(html).toContain('aria-label="Bình Ca 2');
  });
});
