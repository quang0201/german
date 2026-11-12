// Bảng "Theo ngày": mỗi người một dòng, mỗi ngày trong tháng một cột, mỗi ô gộp
// số cái (HC/TC) của sản lượng với giờ làm và giờ tăng ca của chấm công.

const number = (value) => Number(value) || 0;

export function monthDays(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ date, day, isSunday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0 });
  }
  return days;
}

function attendanceDay(day) {
  const shifts = day?.shifts ?? [];
  const regular = shifts.reduce((sum, shift) => sum + (shift.valueKind === "Hours" ? number(shift.workedHours) : 0), 0);
  const leave = shifts.some((shift) => shift.valueKind === "PaidLeave") ? "P" : shifts.some((shift) => shift.valueKind === "SickLeave") ? "Ô" : "";
  return { regular, overtime: number(day?.overtimeHours), leave };
}

// productionEmployees: employees của buildEmployeeMonthlyTotals (dayTotals có hc/tc/total);
// attendanceEmployees: kết quả mergeAttendancePayloads.
export function buildDailyMatrix(productionEmployees = [], attendanceEmployees = [], monthKey) {
  const people = new Map();
  const person = (id, code, name, isActive) => {
    let entry = people.get(id);
    if (!entry) {
      entry = { employeeId: id, code, name, isActive: isActive !== false, cells: {} };
      people.set(id, entry);
    }
    return entry;
  };
  const cell = (entry, date) => (entry.cells[date] ??= { hc: 0, tc: 0, total: 0, regular: 0, overtime: 0, leave: "" });

  for (const employee of productionEmployees) {
    const entry = person(employee.employeeId, employee.code, employee.name, employee.isActive);
    for (const day of employee.dayTotals ?? []) {
      const target = cell(entry, day.date);
      target.hc += number(day.hc);
      target.tc += number(day.tc);
      target.total += number(day.total);
    }
  }
  for (const employee of attendanceEmployees) {
    const entry = person(employee.employeeId, employee.code, employee.name, employee.isActive);
    for (const [date, day] of employee.daysByDate) {
      const status = attendanceDay(day);
      if (status.regular === 0 && status.overtime === 0 && !status.leave) continue;
      Object.assign(cell(entry, date), status);
    }
  }

  const dayTotals = {};
  const rows = [];
  for (const entry of people.values()) {
    const totals = { hc: 0, tc: 0, total: 0, regular: 0, overtime: 0, workDays: 0 };
    for (const [date, value] of Object.entries(entry.cells)) {
      totals.hc += value.hc;
      totals.tc += value.tc;
      totals.total += value.total;
      totals.regular += value.regular;
      totals.overtime += value.overtime;
      if (value.regular > 0 || value.overtime > 0) totals.workDays += 1;
      const sum = (dayTotals[date] ??= { hc: 0, tc: 0, total: 0, overtime: 0 });
      sum.hc += value.hc;
      sum.tc += value.tc;
      sum.total += value.total;
      sum.overtime += value.overtime;
    }
    rows.push({ ...entry, totals });
  }
  rows.sort((a, b) => b.totals.total - a.totals.total
    || (b.totals.regular + b.totals.overtime) - (a.totals.regular + a.totals.overtime)
    || a.name.localeCompare(b.name, "vi"));

  return {
    days: monthDays(monthKey),
    rows,
    dayTotals,
    summary: {
      employeeCount: rows.length,
      hc: rows.reduce((sum, row) => sum + row.totals.hc, 0),
      tc: rows.reduce((sum, row) => sum + row.totals.tc, 0),
      total: rows.reduce((sum, row) => sum + row.totals.total, 0),
      overtime: rows.reduce((sum, row) => sum + row.totals.overtime, 0),
    },
  };
}
