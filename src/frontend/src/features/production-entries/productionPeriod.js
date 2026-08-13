function pad(value) {
  return String(value).padStart(2, "0");
}

function parseLocalIsoDate(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, days) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export function localIsoDate(date = new Date()) {
  return formatLocalDate(date);
}

export function formatDisplayDate(isoDate) {
  const date = parseLocalIsoDate(isoDate);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function derivePeriodRange({ periodMode, anchorDate, customFromDate, customUntilDate }) {
  if (periodMode === "custom") {
    return { fromDate: customFromDate, untilDate: customUntilDate };
  }

  const anchor = parseLocalIsoDate(anchorDate);

  if (periodMode === "week") {
    const daysSinceMonday = (anchor.getDay() + 6) % 7;
    const monday = addDays(anchor, -daysSinceMonday);
    return { fromDate: localIsoDate(monday), untilDate: localIsoDate(addDays(monday, 6)) };
  }

  if (periodMode === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
    return { fromDate: localIsoDate(first), untilDate: localIsoDate(last) };
  }

  return { fromDate: anchorDate, untilDate: anchorDate };
}

export function shiftPeriod(periodMode, anchorDate, direction) {
  const anchor = parseLocalIsoDate(anchorDate);
  const amount = Number(direction);

  if (periodMode === "week") {
    return localIsoDate(addDays(anchor, amount * 7));
  }

  if (periodMode === "month") {
    const target = new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1, 12);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
    const day = Math.min(anchor.getDate(), lastDay);
    return localIsoDate(new Date(target.getFullYear(), target.getMonth(), day, 12));
  }

  return localIsoDate(addDays(anchor, amount));
}

export function formatPeriodLabel(state) {
  const { periodMode, anchorDate, customFromDate, customUntilDate } = state;

  if (periodMode === "custom") {
    if (!customFromDate || !customUntilDate) return "";
    return `${formatDisplayDate(customFromDate)} – ${formatDisplayDate(customUntilDate)}`;
  }

  if (periodMode === "month") {
    const month = parseLocalIsoDate(anchorDate);
    return `${pad(month.getMonth() + 1)}/${month.getFullYear()}`;
  }

  const range = derivePeriodRange({ periodMode, anchorDate, customFromDate, customUntilDate });
  if (periodMode === "week") {
    return `${formatDisplayDate(range.fromDate)} – ${formatDisplayDate(range.untilDate)}`;
  }

  return formatDisplayDate(range.fromDate);
}
