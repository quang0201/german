import React, { useEffect, useState } from "react";
import {
  createProductionExportDraft,
  createProductionExportPayload,
  deriveExportRange,
  exportRangeError,
} from "./productionExport.js";
import { formatDisplayDate } from "./productionPeriod.js";

const presets = [
  { key: "day", label: "Ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
  { key: "custom", label: "Tùy chọn" },
];

function displayDate(isoDate) {
  return isoDate ? formatDisplayDate(isoDate) : "—";
}

export function ProductionExportDialog({
  open = false,
  initialMode = "day",
  initialAnchorDate = "",
  initialFromDate = "",
  initialUntilDate = "",
  onClose,
  onExport,
}) {
  const [draft, setDraft] = useState(() => createProductionExportDraft({
    initialMode,
    initialAnchorDate,
    initialFromDate,
    initialUntilDate,
  }));

  useEffect(() => {
    if (open) {
      setDraft(createProductionExportDraft({
        initialMode,
        initialAnchorDate,
        initialFromDate,
        initialUntilDate,
      }));
    }
  }, [open, initialMode, initialAnchorDate, initialFromDate, initialUntilDate]);

  if (!open) return null;

  const rangeError = exportRangeError(draft.fromDate, draft.untilDate);

  function selectPreset(periodMode) {
    if (periodMode === "custom") {
      setDraft((current) => ({ ...current, periodMode }));
      return;
    }

    setDraft((current) => ({
      ...current,
      periodMode,
      ...deriveExportRange({ periodMode, anchorDate: current.anchorDate }),
    }));
  }

  function updateDate(key, value) {
    setDraft((current) => ({ ...current, periodMode: "custom", [key]: value }));
  }

  function submit() {
    if (!rangeError) onExport?.(createProductionExportPayload(draft));
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-export-dialog" role="dialog" aria-modal="true" aria-labelledby="production-export-dialog-title">
        <h2 id="production-export-dialog-title">Xuất Excel</h2>
        <div className="erp-dialog-body">
          <p>Chọn kỳ export độc lập với khoảng ngày đang hiển thị trên danh sách. Tối đa 366 ngày.</p>
          <div className="erp-export-presets" role="group" aria-label="Chọn kỳ export">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className="erp-button erp-button-secondary"
                data-export-preset={preset.key}
                aria-pressed={draft.periodMode === preset.key}
                onClick={() => selectPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {draft.periodMode === "custom" && (
            <div className="erp-export-date-fields" aria-label="Khoảng ngày export">
              <label>
                <span>Từ ngày</span>
                <input className="erp-control" type="date" value={draft.fromDate} onChange={(event) => updateDate("fromDate", event.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input className="erp-control" type="date" value={draft.untilDate} onChange={(event) => updateDate("untilDate", event.target.value)} />
              </label>
            </div>
          )}
          <p className="erp-export-range">Khoảng chọn: <strong>{displayDate(draft.fromDate)} → {displayDate(draft.untilDate)}</strong></p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.excludeSundays}
              onChange={(event) => setDraft((current) => ({ ...current, excludeSundays: event.target.checked }))}
            />
            <span>Bỏ Chủ nhật</span>
          </label>
          {rangeError && <p className="erp-inline-message erp-inline-error" role="alert">{rangeError}</p>}
        </div>
        <div className="erp-dialog-actions">
          <button type="button" className="erp-button erp-button-secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="erp-button erp-button-primary" onClick={submit} disabled={Boolean(rangeError)}>Xuất Excel</button>
        </div>
      </section>
    </div>
  );
}
