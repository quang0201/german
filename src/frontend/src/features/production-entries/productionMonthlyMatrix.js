const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function parseMonthKey(monthKey) {
  const [yearText, monthText] = String(monthKey).split("-");
  return { year: Number(yearText), month: Number(monthText) };
}

export function currentMonthKey(isoDate) {
  return String(isoDate).slice(0, 7);
}

export function shiftMonth(monthKey, direction) {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + direction, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function monthBounds(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = String(month).padStart(2, "0");
  return {
    fromDate: `${year}-${monthText}-01`,
    untilDate: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function monthDateAxis(monthKey, excludeSundays = true) {
  const { year, month } = parseMonthKey(monthKey);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = String(month).padStart(2, "0");
  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay();
    if (excludeSundays && weekday === 0) continue;
    const dayText = String(day).padStart(2, "0");
    days.push({
      isoDate: `${year}-${monthText}-${dayText}`,
      weekdayLabel: WEEKDAYS[weekday],
      displayDate: `${dayText}/${monthText}`,
      isSunday: weekday === 0,
    });
  }
  return days;
}

export function buildProductionMonthlyMatrixUrl(filters) {
  const { year, month } = parseMonthKey(filters.monthKey);
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    excludeSundays: String(filters.excludeSundays !== false),
  });
  for (const key of ["employeeId", "orderId", "operationId", "search"]) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return `/api/production-entries/monthly-matrix?${params}`;
}

export function matrixCellAction(cell) {
  if (!cell || !cell.entryCount) return "create";
  if (cell.entryCount > 1) return "choose-record";
  return cell.records?.[0]?.entryMode === "Direct" ? "edit-direct" : "open-entry";
}
