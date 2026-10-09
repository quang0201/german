import { derivePeriodRange } from "./productionPeriod.js";

const MILLISECONDS_PER_DAY = 86_400_000;
const MAX_EXPORT_DAYS = 366;

function calendarDayNumber(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function exportRangeError(fromDate, untilDate) {
  if (!fromDate || !untilDate) return "Chọn đầy đủ từ ngày và đến ngày.";
  if (fromDate > untilDate) return "Từ ngày phải trước hoặc bằng đến ngày.";

  const durationInDays = (calendarDayNumber(untilDate) - calendarDayNumber(fromDate)) / MILLISECONDS_PER_DAY + 1;
  if (durationInDays > MAX_EXPORT_DAYS) return "Khoảng ngày export tối đa 366 ngày.";
  return "";
}

export function listRangeError(fromDate, untilDate) {
  if (!fromDate || !untilDate) return "Chọn đầy đủ từ ngày và đến ngày.";
  if (fromDate > untilDate) return "Từ ngày phải trước hoặc bằng đến ngày.";

  const durationInDays = (calendarDayNumber(untilDate) - calendarDayNumber(fromDate)) / MILLISECONDS_PER_DAY + 1;
  if (durationInDays > 31) return "Khoảng ngày danh sách tối đa 31 ngày.";
  return "";
}

export function deriveExportRange({ periodMode, anchorDate, customFromDate, customUntilDate }) {
  if (periodMode === "custom") {
    return { fromDate: customFromDate, untilDate: customUntilDate };
  }

  return derivePeriodRange({
    periodMode: periodMode === "week" || periodMode === "month" ? periodMode : "day",
    anchorDate,
  });
}

export function createProductionExportDraft({
  initialMode,
  initialAnchorDate,
  initialFromDate,
  initialUntilDate,
}) {
  const periodMode = initialMode || "day";
  const range = periodMode === "custom"
    ? { fromDate: initialFromDate, untilDate: initialUntilDate }
    : deriveExportRange({
        periodMode,
        anchorDate: initialAnchorDate,
        customFromDate: initialFromDate,
        customUntilDate: initialUntilDate,
      });

  return {
    periodMode,
    anchorDate: initialAnchorDate,
    ...range,
    excludeSundays: true,
  };
}

export function createProductionExportPayload(draft) {
  return {
    fromDate: draft.fromDate,
    untilDate: draft.untilDate,
    excludeSundays: Boolean(draft.excludeSundays),
  };
}

function monthYear(isoDate) {
  const [year, month] = String(isoDate).split("-");
  return /^\d{4}$/.test(year) && /^\d{2}$/.test(month) ? `${month}-${year}` : "";
}

export function productionExportFileName(fromDate, untilDate, prefix = "san-luong") {
  const from = monthYear(fromDate);
  const until = monthYear(untilDate);
  if (!from || !until) return `${prefix}.xlsx`;
  const period = from === until ? from : `${from}_${until}`;
  return `${prefix}_${period}.xlsx`;
}
