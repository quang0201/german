import React, { useEffect, useState } from "react";
import { deriveExportRange, exportRangeError } from "./productionExport.js";

const presets = [
  { key: "day", label: "Ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
  { key: "custom", label: "Tùy chọn" },
];

function initialDraft({ initialMode, initialAnchorDate, initialFromDate, initialUntilDate }) {
  const mode = initialMode || "day";
  const range = mode === "custom"
    ? { fromDate: initialFromDate, untilDate: initialUntilDate }
    : deriveExportRange({ periodMode: mode, anchorDate: initialAnchorDate, customFromDate: initialFromDate, customUntilDate: initialUntilDate });
  return { periodMode: mode, anchorDate: initialAnchorDate, ...range };
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
  const [draft, setDraft] = useState(() => initialDraft({ initialMode, initialAnchorDate, initialFromDate, initialUntilDate }));

  useEffect(() => {
    if (open) {
      setDraft(initialDraft({ initialMode, initialAnchorDate, initialFromDate, initialUntilDate }));
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
    if (!rangeError) onExport?.({ fromDate: draft.fromDate, untilDate: draft.untilDate });
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
          <p className="erp-export-range">Khoảng chọn: <strong>{draft.fromDate || "—"} → {draft.untilDate || "—"}</strong></p>
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
