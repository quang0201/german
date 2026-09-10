import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { externalSourceForm, buildExternalSourcePayload } from "./externalSourceConfig.js";

export function ProductionExternalSourceDialog({ open = false, source = null, loading = false, error = "", onClose, onSubmit, onChange }) {
  const [draft, setDraft] = useState(() => externalSourceForm(source || {}));

  useEffect(() => {
    if (open) setDraft(externalSourceForm(source || {}));
  }, [open, source]);

  if (!open) return null;

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    onChange?.();
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="external-source-dialog-title">
        <div className="erp-dialog-header">
          <h2 id="external-source-dialog-title">{source ? "Sửa nguồn gia công" : "Thêm nguồn gia công"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể lưu nguồn gia công.">{error}</Alert>}
        <form onSubmit={(event) => { event.preventDefault(); onSubmit?.(buildExternalSourcePayload(draft)); }}>
          <Field label="Tên nguồn" required>
            <input className="erp-control" required maxLength="200" value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ví dụ: Xưởng ngoài A" />
          </Field>
          {source && <label className="erp-employee-active"><input type="checkbox" checked={draft.isActive} onChange={(event) => update("isActive", event.target.checked)} /><span>Đang sử dụng</span></label>}
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : "Lưu nguồn"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
