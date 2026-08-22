import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import "./ProductionExternalQuantityDialog.css";

function localToday() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function draftFor(item) {
  return {
    receivedDate: item?.receivedDate || localToday(),
    quantity: item?.quantity ?? "",
    sourceName: item?.sourceName || "",
    note: item?.note || "",
  };
}

export function ProductionExternalQuantityDialog({ open = false, order, operation, item = null, loading = false, error = "", onClose, onSubmit, onChange }) {
  const [draft, setDraft] = useState(() => draftFor(item));

  useEffect(() => {
    if (open) setDraft(draftFor(item));
  }, [open, item]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    onChange?.();
  }

  function submit(event) {
    event.preventDefault();
    onSubmit?.(draft);
  }

  const editing = Boolean(item);
  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-production-external-dialog" role="dialog" aria-modal="true" aria-labelledby="production-external-dialog-title">
        <div className="erp-production-external-dialog-header">
          <h2 id="production-external-dialog-title">{editing ? "Sửa sản lượng nhận ngoài" : "Bổ sung sản lượng ngoài"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể ghi nhận sản lượng ngoài.">{error}</Alert>}
        <div className="erp-production-external-summary">
          <span>Mã SX: <strong>{order?.code || "—"}</strong></span>
          <span>CĐ{operation?.operationNumber}: <strong>{operation?.name || "—"}</strong></span>
          <span>ĐVT: <strong>{operation?.unit || "—"}</strong></span>
        </div>
        <form onSubmit={submit}>
          <div className="erp-production-external-fields">
            <Field label="Ngày nhận" required>
              <input className="erp-control" required type="date" value={draft.receivedDate} onChange={(event) => update("receivedDate", event.target.value)} />
            </Field>
            <Field label="Số lượng" required hint="> 0">
              <input className="erp-control" required min="0.01" step="0.01" type="number" value={draft.quantity} onChange={(event) => update("quantity", event.target.value)} />
            </Field>
            <Field label="Nguồn bên ngoài">
              <input className="erp-control" maxLength="200" value={draft.sourceName} onChange={(event) => update("sourceName", event.target.value)} placeholder="Ví dụ: Xưởng ngoài A" />
            </Field>
            <Field label="Ghi chú">
              <textarea className="erp-control" maxLength="1000" rows="3" value={draft.note} onChange={(event) => update("note", event.target.value)} />
            </Field>
          </div>
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Ghi nhận"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
