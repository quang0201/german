import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { buildShiftUpdatePayload, shiftTemplateForm } from "./shiftTemplateDialog.js";
import "./ShiftTemplateDialog.css";

export function ShiftTemplateDialog({ open = false, shift = null, loading = false, error = "", onClose, onSubmit, onChange }) {
  const [draft, setDraft] = useState(() => shiftTemplateForm(shift ?? {}));

  useEffect(() => {
    if (open) setDraft(shiftTemplateForm(shift ?? {}));
  }, [open, shift]);

  if (!open) return null;

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    onChange?.();
  }

  function updatePeriod(index, key, value) {
    setDraft((current) => ({
      ...current,
      periods: current.periods.map((period, periodIndex) => periodIndex === index ? { ...period, [key]: value } : period),
    }));
    onChange?.();
  }

  function addPeriod() {
    setDraft((current) => ({
      ...current,
      periods: [...current.periods, { name: `Ca ${current.periods.length + 1}`, startTime: "", endTime: "" }],
    }));
    onChange?.();
  }

  function removePeriod(index) {
    setDraft((current) => ({ ...current, periods: current.periods.filter((_, periodIndex) => periodIndex !== index) }));
    onChange?.();
  }

  function submit(event) {
    event.preventDefault();
    onSubmit?.(buildShiftUpdatePayload(draft));
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-shift-template-dialog" role="dialog" aria-modal="true" aria-labelledby="shift-template-dialog-title">
        <div className="erp-shift-template-dialog-header">
          <h2 id="shift-template-dialog-title">Sửa bộ ca</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể lưu bộ ca.">{error}</Alert>}
        <form onSubmit={submit}>
          <div className="erp-shift-template-dialog-fields">
            <Field label="Tên bộ ca" required>
              <input className="erp-control" required value={draft.name} onChange={(event) => update("name", event.target.value)} />
            </Field>
            <div className="erp-shift-template-periods">
              <div className="erp-shift-template-period-heading"><strong>Khung giờ HC</strong><button type="button" className="erp-button erp-button-secondary" onClick={addPeriod} disabled={loading}>+ Thêm khung giờ</button></div>
              {draft.periods.map((period, index) => (
                <div className="erp-shift-template-period" key={index}>
                  <Field label="Tên ca" required>
                    <input className="erp-control" required value={period.name} onChange={(event) => updatePeriod(index, "name", event.target.value)} />
                  </Field>
                  <Field label="Từ" required>
                    <input className="erp-control" required type="time" value={period.startTime} onChange={(event) => updatePeriod(index, "startTime", event.target.value)} />
                  </Field>
                  <Field label="Đến" required>
                    <input className="erp-control" required type="time" value={period.endTime} onChange={(event) => updatePeriod(index, "endTime", event.target.value)} />
                  </Field>
                  <button type="button" className="erp-button erp-button-secondary erp-shift-template-remove" onClick={() => removePeriod(index)} disabled={loading || draft.periods.length <= 1}>Xóa</button>
                </div>
              ))}
            </div>
            <label className="erp-shift-template-active"><input type="checkbox" checked={draft.isActive} onChange={(event) => update("isActive", event.target.checked)} /><span>Đang hoạt động</span></label>
          </div>
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : "Lưu thay đổi"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
