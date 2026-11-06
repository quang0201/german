import { describe, expect, test } from "bun:test";
import { attendanceWindows, buildAttendanceUrl, buildEmployeeAttendanceTotals, mergeAttendancePayloads } from "./attendanceMonthlyTotals.js";

const shift = (valueKind, workedHours) => ({ valueKind, workedHours });
const day = (workDate, overtimeHours, shifts) => ({ workDate, overtimeHours, shifts });
const work = (workDate, overtime = 0) => day(workDate, overtime, [shift("Hours", 4), shift("Hours", 4)]);
const totals = (regular, overtime, paidLeave = 0, sickLeave = 0) => ({ regularWorkedHours: regular, overtimeHours: overtime, paidLeaveHours: paidLeave, sickLeaveHours: sickLeave });

describe("attendance windows", () => {
  test("chia tháng thành các cửa sổ tối đa 11 ngày và không vượt quá tháng", () => {
    expect(attendanceWindows("2026-10")).toEqual([{ dayFrom: 1, dayCount: 11 }, { dayFrom: 12, dayCount: 11 }, { dayFrom: 23, dayCount: 9 }]);
    expect(attendanceWindows("2026-02")).toEqual([{ dayFrom: 1, dayCount: 11 }, { dayFrom: 12, dayCount: 11 }, { dayFrom: 23, dayCount: 6 }]);
  });

  test("dựng URL có phân trang nhân viên", () => {
    expect(buildAttendanceUrl("2026-10", { dayFrom: 12, dayCount: 11 })).toBe("/api/attendance/monthly?year=2026&month=10&employeeLimit=100&dayFrom=12&dayCount=11");
    expect(buildAttendanceUrl("2026-10", { dayFrom: 1, dayCount: 11 }, "abc")).toContain("employeeCursor=abc");
  });
});

describe("mergeAttendancePayloads", () => {
  test("gộp các cửa sổ ngày của cùng một nhân viên", () => {
    const merged = mergeAttendancePayloads([
      { employees: [{ employeeId: "h", employeeCode: "4", fullName: "Hương", isActive: true, totals: totals(16, 3), days: [work("2026-10-01", 1)] }] },
      { employees: [{ employeeId: "h", employeeCode: "4", fullName: "Hương", isActive: true, totals: totals(16, 3), days: [work("2026-10-12", 2)] }] },
    ]);
    expect(merged).toHaveLength(1);
    expect([...merged[0].daysByDate.keys()]).toEqual(["2026-10-01", "2026-10-12"]);
  });
});

describe("buildEmployeeAttendanceTotals", () => {
  const attendance = mergeAttendancePayloads([{ employees: [
    { employeeId: "h", employeeCode: "4", fullName: "Quách Thị Hương", isActive: true, totals: totals(24, 4, 8), days: [
      work("2026-10-01", 1),
      work("2026-10-02", 3),
      day("2026-10-03", 0, [shift("PaidLeave"), shift("PaidLeave")]),
      day("2026-10-04", 0, [shift("Empty"), shift("Empty")]),
    ] },
    { employeeId: "x", employeeCode: "9", fullName: "Không có gì", isActive: true, totals: totals(0, 0), days: [day("2026-10-01", 0, [shift("Empty")])] },
    { employeeId: "l", employeeCode: "7", fullName: "Làm chưa chấm", isActive: true, totals: totals(0, 0), days: [] },
  ] }]);
  const production = [
    { employeeId: "h", total: 3700, dayTotals: [{ date: "2026-10-01", total: 2900 }, { date: "2026-10-05", total: 800 }] },
    { employeeId: "l", total: 500, dayTotals: [{ date: "2026-10-06", total: 500 }] },
  ];
  const result = buildEmployeeAttendanceTotals(attendance, production);
  const huong = result.rows.find((row) => row.employeeId === "h");

  test("lấy tổng giờ theo tháng từ API và đếm ngày làm", () => {
    expect(huong).toMatchObject({ regular: 24, overtime: 4, paidLeave: 8, sickLeave: 0, workDays: 2, outputTotal: 3700 });
  });

  test("đánh dấu ngày có chấm công nhưng chưa có sản lượng và ngược lại", () => {
    const byDate = Object.fromEntries(huong.days.map((item) => [item.date, item]));
    expect(byDate["2026-10-01"]).toMatchObject({ attended: true, output: 2900, missingOutput: false });
    expect(byDate["2026-10-02"]).toMatchObject({ attended: true, output: 0, missingOutput: true });
    expect(byDate["2026-10-03"]).toMatchObject({ paidLeave: true, attended: false, missingOutput: false });
    expect(byDate["2026-10-05"]).toMatchObject({ attended: false, output: 800, noAttendance: true });
    expect(byDate["2026-10-04"]).toBeUndefined();
    expect(huong.missingOutputDays).toBe(1);
    expect(huong.noAttendanceDays).toBe(1);
  });

  test("bỏ người không có chấm công và không có sản lượng, giữ người chỉ có sản lượng", () => {
    expect(result.rows.map((row) => row.employeeId)).toEqual(["h", "l"]);
    expect(result.rows[1]).toMatchObject({ regular: 0, outputTotal: 500, noAttendanceDays: 1 });
  });

  test("tổng kết tháng", () => {
    expect(result.summary).toEqual({ employeeCount: 2, regular: 24, overtime: 4, paidLeave: 8, missingOutputDays: 1 });
  });

  test("dữ liệu rỗng không gây lỗi", () => {
    expect(buildEmployeeAttendanceTotals(undefined, undefined).rows).toEqual([]);
  });
});
