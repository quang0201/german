import { describe, expect, test } from "bun:test";
import { buildDailyMatrix, monthDays } from "./dailyMatrix.js";
import { mergeAttendancePayloads } from "./attendanceMonthlyTotals.js";

const shift = (valueKind, workedHours) => ({ valueKind, workedHours });
const work = (workDate, overtime = 0, hours = 4) => ({ workDate, overtimeHours: overtime, shifts: [shift("Hours", hours), shift("Hours", hours)] });
const totals = { regularWorkedHours: 0, overtimeHours: 0, paidLeaveHours: 0, sickLeaveHours: 0 };

describe("monthDays", () => {
  test("liệt kê đủ ngày trong tháng và đánh dấu Chủ nhật", () => {
    const days = monthDays("2026-11");
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ date: "2026-11-01", day: 1, isSunday: true });
    expect(days[1].isSunday).toBe(false);
    expect(days[7].isSunday).toBe(true);
  });
});

describe("buildDailyMatrix", () => {
  const production = [
    { employeeId: "a", code: "A", name: "An", isActive: true, total: 2300, dayTotals: [{ date: "2026-11-02", hc: 1000, tc: 300, total: 1300 }, { date: "2026-11-03", hc: 1000, tc: 0, total: 1000 }] },
    { employeeId: "b", code: "B", name: "Bình", isActive: true, total: 500, dayTotals: [{ date: "2026-11-02", hc: 500, tc: 0, total: 500 }] },
  ];
  const attendance = mergeAttendancePayloads([{ employees: [
    { employeeId: "a", employeeCode: "A", fullName: "An", isActive: true, totals, days: [work("2026-11-02", 3), work("2026-11-03")] },
    { employeeId: "c", employeeCode: "C", fullName: "Chỉ chấm công", isActive: true, totals, days: [work("2026-11-02", 1, 4)] },
  ] }]);
  const view = buildDailyMatrix(production, attendance, "2026-11");

  test("mỗi người một dòng; sắp theo tổng sản lượng", () => {
    expect(view.rows.map((row) => row.name)).toEqual(["An", "Bình", "Chỉ chấm công"]);
  });

  test("ô ngày có số cái HC/TC và giờ làm/giờ tăng ca", () => {
    expect(view.rows[0].cells["2026-11-02"]).toEqual({ hc: 1000, tc: 300, total: 1300, regular: 8, overtime: 3, leave: "" });
  });

  test("tổng của người: số cái, giờ tăng ca, ngày công", () => {
    expect(view.rows[0].totals).toEqual({ hc: 2000, tc: 300, total: 2300, regular: 16, overtime: 3, workDays: 2 });
  });

  test("người chỉ có chấm công vẫn xuất hiện; người chỉ có sản lượng có giờ 0", () => {
    expect(view.rows[2].totals.total).toBe(0);
    expect(view.rows[2].totals.workDays).toBe(1);
    expect(view.rows[1].cells["2026-11-02"]).toEqual({ hc: 500, tc: 0, total: 500, regular: 0, overtime: 0, leave: "" });
  });

  test("dòng cộng từng ngày và tổng toàn bảng", () => {
    expect(view.dayTotals["2026-11-02"]).toEqual({ hc: 1500, tc: 300, total: 1800, overtime: 4 });
    expect(view.summary).toEqual({ employeeCount: 3, hc: 2500, tc: 300, total: 2800, overtime: 4 });
  });

  test("nghỉ phép được đánh dấu P", () => {
    const leave = mergeAttendancePayloads([{ employees: [{ employeeId: "a", employeeCode: "A", fullName: "An", isActive: true, totals, days: [{ workDate: "2026-11-04", overtimeHours: 0, shifts: [shift("PaidLeave"), shift("PaidLeave")] }] }] }]);
    const result = buildDailyMatrix(production, leave, "2026-11");
    expect(result.rows.find((row) => row.employeeId === "a").cells["2026-11-04"].leave).toBe("P");
  });
});
