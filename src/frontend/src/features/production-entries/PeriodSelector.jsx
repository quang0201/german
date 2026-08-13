import React from "react";
import { derivePeriodRange, formatPeriodLabel, localIsoDate, shiftPeriod } from "./productionPeriod.js";

const presets = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "custom", label: "Tùy chọn" },
];

function activePreset(periodMode, anchorDate) {
  if (periodMode === "custom") return "custom";

  const today = localIsoDate();
  if (periodMode === "week" || periodMode === "month") {
    const currentRange = derivePeriodRange({ periodMode, anchorDate: today });
    return anchorDate >= currentRange.fromDate && anchorDate <= currentRange.untilDate
      ? periodMode
      : "";
  }

  if (anchorDate === today) return "today";
  if (anchorDate === shiftPeriod("day", today, -1)) return "yesterday";
  return "";
}

function navigationLabels(periodMode) {
  if (periodMode === "week") return { previous: "Tuần trước", next: "Tuần sau" };
  if (periodMode === "month") return { previous: "Tháng trước", next: "Tháng sau" };
  return { previous: "Ngày trước", next: "Ngày sau" };
}

export function PeriodSelector({
  periodMode,
  anchorDate,
  customFromDate,
  customUntilDate,
  appliedCustomFromDate = customFromDate,
  appliedCustomUntilDate = customUntilDate,
  isCustomEditing = false,
  onPreset,
  onShift,
  onCustomChange,
}) {
  const active = activePreset(periodMode, anchorDate);
  const labels = navigationLabels(periodMode);
  const periodLabel = formatPeriodLabel({ periodMode, anchorDate, customFromDate: appliedCustomFromDate, customUntilDate: appliedCustomUntilDate });
  const showCustomFields = isCustomEditing || periodMode === "custom";

  return (
    <section className="erp-period-selector" aria-label="Khoảng thời gian">
      <div className="erp-period-presets" role="group" aria-label="Chọn kỳ">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            data-period-preset={preset.key}
            aria-pressed={active === preset.key}
            onClick={() => onPreset?.(preset.key)}
            className="erp-button erp-button-secondary"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="erp-period-navigation" role="group" aria-label="Điều hướng kỳ">
        {periodMode !== "custom" && (
          <>
            <button type="button" aria-label={labels.previous} onClick={() => onShift?.(-1)} className="erp-button erp-button-secondary">‹</button>
            <span className="erp-period-label" aria-live="polite">{periodLabel}</span>
            <button type="button" aria-label={labels.next} onClick={() => onShift?.(1)} className="erp-button erp-button-secondary">›</button>
          </>
        )}
        {periodMode === "custom" && <span className="erp-period-label" aria-live="polite">{periodLabel}</span>}
      </div>

      {showCustomFields && (
        <div className="erp-period-custom-fields">
          <label>
            <span>Từ ngày</span>
            <input
              className="erp-control"
              type="date"
              value={customFromDate}
              onChange={(event) => onCustomChange?.("fromDate", event.target.value)}
            />
          </label>
          <label>
            <span>Đến ngày</span>
            <input
              className="erp-control"
              type="date"
              value={customUntilDate}
              onChange={(event) => onCustomChange?.("untilDate", event.target.value)}
            />
          </label>
        </div>
      )}
    </section>
  );
}
