// Gom dữ liệu chấm công tháng (API /api/attendance/monthly, tải theo từng cửa sổ ngày)
// thành tổng giờ của từng người, đối chiếu với sản lượng từng ngày.

const number = (value) => Number(value) || 0;

export const ATTENDANCE_WINDOW_DAYS = 11; // API chỉ nhận 1–11 ngày mỗi lần

export function attendanceWindows(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const windows = [];
  for (let dayFrom = 1; dayFrom <= lastDay; dayFrom += ATTENDANCE_WINDOW_DAYS) {
    windows.push({ dayFrom, dayCount: Math.min(ATTENDANCE_WINDOW_DAYS, lastDay - dayFrom + 1) });
  }
  return windows;
}

export function buildAttendanceUrl(monthKey, window, cursor = "") {
  const [year, month] = String(monthKey).split("-");
  const params = new URLSearchParams({ year, month, employeeLimit: "100", dayFrom: String(window.dayFrom), dayCount: String(window.dayCount) });
  if (cursor) params.set("employeeCursor", cursor);
  return `/api/attendance/monthly?${params}`;
}

// Gộp nhiều trang/cửa sổ của API thành một bản ghi cho mỗi nhân viên.
export function mergeAttendancePayloads(payloads) {
  const byEmployee = new Map();
  for (const payload of payloads ?? []) {
    for (const employee of payload?.employees ?? []) {
      let entry = byEmployee.get(employee.employeeId);
      if (!entry) {
        entry = { employeeId: employee.employeeId, code: employee.employeeCode, name: employee.fullName, isActive: employee.isActive !== false, totals: employee.totals, daysByDate: new Map() };
        byEmployee.set(employee.employeeId, entry);
      }
      for (const day of employee.days ?? []) entry.daysByDate.set(String(day.workDate).slice(0, 10), day);
    }
  }
  return [...byEmployee.values()];
}

function dayStatus(day) {
  const shifts = day?.shifts ?? [];
  const worked = shifts.reduce((sum, shift) => sum + (shift.valueKind === "Hours" ? number(shift.workedHours) : 0), 0);
  const paidLeave = shifts.some((shift) => shift.valueKind === "PaidLeave");
  const sickLeave = shifts.some((shift) => shift.valueKind === "SickLeave");
  return { regular: worked, overtime: number(day?.overtimeHours), paidLeave, sickLeave };
}

// attendanceEmployees: kết quả mergeAttendancePayloads; productionEmployees: employees của buildEmployeeMonthlyTotals.
export function buildEmployeeAttendanceTotals(attendanceEmployees, productionEmployees = []) {
  const outputByEmployee = new Map(productionEmployees.map((item) => [item.employeeId, item]));
  const rows = [];

  for (const employee of attendanceEmployees ?? []) {
    const production = outputByEmployee.get(employee.employeeId);
    const outputByDate = new Map((production?.dayTotals ?? []).map((day) => [day.date, day.total]));
    const dates = new Set([...employee.daysByDate.keys(), ...outputByDate.keys()]);

    const days = [];
    for (const date of [...dates].sort()) {
      const status = dayStatus(employee.daysByDate.get(date));
      const output = outputByDate.get(date) ?? 0;
      const attended = status.regular > 0 || status.overtime > 0;
      if (!attended && !status.paidLeave && !status.sickLeave && output === 0) continue;
      days.push({ date, ...status, attended, output, missingOutput: attended && output === 0, noAttendance: !attended && !status.paidLeave && !status.sickLeave && output > 0 });
    }

    const totals = employee.totals ?? {};
    const regular = number(totals.regularWorkedHours);
    const overtime = number(totals.overtimeHours);
    const paidLeave = number(totals.paidLeaveHours);
    const sickLeave = number(totals.sickLeaveHours);
    if (days.length === 0 && regular + overtime + paidLeave + sickLeave === 0) continue;

    rows.push({
      employeeId: employee.employeeId,
      code: employee.code,
      name: employee.name,
      isActive: employee.isActive,
      regular, overtime, paidLeave, sickLeave,
      workDays: days.filter((day) => day.attended).length,
      outputTotal: production?.total ?? 0,
      missingOutputDays: days.filter((day) => day.missingOutput).length,
      noAttendanceDays: days.filter((day) => day.noAttendance).length,
      days,
    });
  }

  rows.sort((a, b) => (b.regular + b.overtime) - (a.regular + a.overtime) || a.name.localeCompare(b.name, "vi"));
  return {
    rows,
    summary: {
      employeeCount: rows.length,
      regular: rows.reduce((sum, row) => sum + row.regular, 0),
      overtime: rows.reduce((sum, row) => sum + row.overtime, 0),
      paidLeave: rows.reduce((sum, row) => sum + row.paidLeave, 0),
      missingOutputDays: rows.reduce((sum, row) => sum + row.missingOutputDays, 0),
    },
  };
}
