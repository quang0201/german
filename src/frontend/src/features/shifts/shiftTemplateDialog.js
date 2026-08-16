import { toApiTime } from "../../lib/time.js";

function displayTime(value) {
  return String(value ?? "").slice(0, 5);
}

export function shiftTemplateForm(shift = {}) {
  return {
    name: shift.name ?? "",
    isActive: shift.isActive ?? true,
    periods: (shift.periods ?? []).map((period, index) => ({
      name: period.name ?? `Ca ${index + 1}`,
      startTime: displayTime(period.startTime),
      endTime: displayTime(period.endTime),
    })),
  };
}

export function buildShiftUpdatePayload(form) {
  return {
    name: form.name.trim(),
    isActive: Boolean(form.isActive),
    periods: form.periods.map((period, index) => ({
      name: period.name.trim(),
      startTime: toApiTime(period.startTime),
      endTime: toApiTime(period.endTime),
      sortOrder: index + 1,
    })),
  };
}
