import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { emptyProductionOperation, productionOperationForm } from "./productionOperationDialog.js";
import "./ProductionOperationDialog.css";

export function ProductionOperationDialog({ open = false, mode = "create", operation = null, loading = false, error = "", onClose, onSubmit, onChange }) {
  const [draft, setDraft] = useState(() => productionOperationForm(operation ?? emptyProductionOperation()));

  useEffect(() => {
    if (open) setDraft(productionOperationForm(operation ?? emptyProductionOperation()));
  }, [open, operation]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const editing = mode === "edit";

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    onChange?.();
  }

  function submit(event) {
    event.preventDefault();
    onSubmit?.(draft);
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-production-operation-dialog" role="dialog" aria-modal="true" aria-labelledby="production-operation-dialog-title">
        <div className="erp-production-operation-dialog-header">
          <h2 id="production-operation-dialog-title">{editing ? "Sửa công đoạn" : "Thêm công đoạn"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể lưu công đoạn.">{error}</Alert>}
        <form onSubmit={submit}>
          <div className="erp-production-operation-dialog-fields">
            <Field label="Số công đoạn" required>
              <input className="erp-control" required min="1" type="number" value={draft.operationNumber} onChange={(event) => update("operationNumber", event.target.value)} />
            </Field>
            <Field label="Tên công đoạn" required>
              <input className="erp-control" required value={draft.name} onChange={(event) => update("name", event.target.value)} />
            </Field>
            <div className="erp-production-operation-dialog-row">
              <Field label="Đơn vị tính" required>
                <input className="erp-control" required value={draft.unit} onChange={(event) => update("unit", event.target.value)} />
              </Field>
              <Field label="Giá cố định" required hint=">= 0">
                <input className="erp-control" required min="0" step="0.01" type="number" value={draft.fixedPrice} onChange={(event) => update("fixedPrice", event.target.value)} />
              </Field>
            </div>
            <label className="erp-production-operation-active">
              <input type="checkbox" checked={draft.isActive} onChange={(event) => update("isActive", event.target.checked)} />
              <span>Hoạt động</span>
            </label>
          </div>
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm công đoạn"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
