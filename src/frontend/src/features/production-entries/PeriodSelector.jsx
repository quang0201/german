import React, { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "../../lib/useEscapeKey.js";
import { derivePeriodRange, formatDisplayDate, formatPeriodLabel, localIsoDate, shiftPeriod } from "./productionPeriod.js";

const presets = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "custom", label: "Tùy chọn khoảng ngày" },
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

const shortDate = (isoDate) => formatDisplayDate(isoDate).slice(0, 5);

function triggerText({ periodMode, anchorDate, customFromDate, customUntilDate }, active) {
  const full = formatPeriodLabel({ periodMode, anchorDate, customFromDate, customUntilDate });
  if (periodMode === "custom") return full;
  const preset = presets.find((item) => item.key === active);
  if (!preset) return periodMode === "month" ? `Tháng ${full}` : full;
  const range = derivePeriodRange({ periodMode, anchorDate });
  const short = range.fromDate === range.untilDate ? shortDate(range.fromDate) : `${shortDate(range.fromDate)} – ${shortDate(range.untilDate)}`;
  return `${preset.label} · ${short}`;
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
  customActions = null,
  initialOpen = false,
}) {
  const [open, setOpen] = useState(initialOpen);
  const rootRef = useRef(null);
  const active = activePreset(periodMode, anchorDate);
  const labels = navigationLabels(periodMode);
  const text = triggerText({ periodMode, anchorDate, customFromDate: appliedCustomFromDate, customUntilDate: appliedCustomUntilDate }, active);
  const showCustomFields = isCustomEditing || periodMode === "custom";
  const closePopover = () => setOpen(false);

  useEscapeKey(open, closePopover);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsidePress(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [open]);

  // Applying a custom range finishes the edit, so the popover closes with it.
  useEffect(() => {
    if (!isCustomEditing && periodMode === "custom") setOpen(false);
  }, [isCustomEditing, periodMode, appliedCustomFromDate, appliedCustomUntilDate]);

  function choose(key) {
    onPreset?.(key);
    if (key !== "custom") setOpen(false);
  }

  return (
    <div className="erp-period-picker" ref={rootRef} role="group" aria-label="Khoảng thời gian">
      {periodMode !== "custom" && (
        <button type="button" className="erp-square-button" aria-label={labels.previous} onClick={() => onShift?.(-1)}>‹</button>
      )}
      <div className="erp-period-anchor">
        <button type="button" className="erp-pill erp-period-trigger" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}>
          <span className="erp-pill-label">Kỳ</span>
          <b className="erp-period-label" aria-live="polite">{text}</b>
          <span className="erp-pill-caret" aria-hidden="true">▾</span>
        </button>
        {open && (
          <div className="erp-period-popover" role="group" aria-label="Chọn kỳ">
            <div className="erp-period-presets">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  data-period-preset={preset.key}
                  aria-pressed={active === preset.key}
                  onClick={() => choose(preset.key)}
                  className={`erp-period-option${preset.key === "custom" ? " is-wide" : ""}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {showCustomFields && (
              <div className="erp-period-custom-fields">
                <label>
                  <span>Từ ngày</span>
                  <input className="erp-control" type="date" value={customFromDate} onChange={(event) => onCustomChange?.("fromDate", event.target.value)} />
                </label>
                <label>
                  <span>Đến ngày</span>
                  <input className="erp-control" type="date" value={customUntilDate} onChange={(event) => onCustomChange?.("untilDate", event.target.value)} />
                </label>
                {customActions}
              </div>
            )}
          </div>
        )}
      </div>
      {periodMode !== "custom" && (
        <button type="button" className="erp-square-button" aria-label={labels.next} onClick={() => onShift?.(1)}>›</button>
      )}
    </div>
  );
}
