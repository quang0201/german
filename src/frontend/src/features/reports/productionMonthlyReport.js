import { localIsoDate } from "../production-entries/productionPeriod.js";

export function buildProductionMonthlySummaryUrl(orderId, fromMonth, untilMonth) {
  const params = new URLSearchParams({ orderId, fromMonth, untilMonth });
  return `/api/reports/production/monthly-summary?${params.toString()}`;
}

export function currentReportMonthKey(today = new Date()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRangeToDateRange(fromMonth, untilMonth) {
  if (!/^\d{4}-\d{2}$/.test(fromMonth || "") || !/^\d{4}-\d{2}$/.test(untilMonth || "")) {
    return { fromDate: "", untilDate: "" };
  }
  const [fromYear, fromMonthNumber] = fromMonth.split("-").map(Number);
  const [untilYear, untilMonthNumber] = untilMonth.split("-").map(Number);
  const first = new Date(fromYear, fromMonthNumber - 1, 1, 12);
  const last = new Date(untilYear, untilMonthNumber, 0, 12);
  return { fromDate: localIsoDate(first), untilDate: localIsoDate(last) };
}
