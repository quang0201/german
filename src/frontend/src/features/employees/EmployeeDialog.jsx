import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { buildEmployeeCreatePayload, employeeCreateForm } from "./employeeCreate.js";
import { buildEmployeeUpdatePayload, employeeForm } from "./employeeDialog.js";
import "./EmployeeDialog.css";

export function EmployeeDialog({ open = false, mode = "edit", employee = null, shifts = [], loading = false, error = "", onClose, onSubmit, onChange }) {
  const [draft, setDraft] = useState(() => mode === "create" ? employeeCreateForm() : employeeForm(employee ?? {}));

  useEffect(() => {
    if (open) setDraft(mode === "create" ? employeeCreateForm() : employeeForm(employee ?? {}));
  }, [open, employee, mode]);

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
    onSubmit?.(mode === "create" ? buildEmployeeCreatePayload(draft) : buildEmployeeUpdatePayload(draft));
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-employee-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title">
        <div className="erp-employee-dialog-header">
          <h2 id="employee-dialog-title">{mode === "create" ? "Thêm nhân viên" : "Sửa nhân viên"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể lưu nhân viên.">{error}</Alert>}
        <form onSubmit={submit}>
          <div className="erp-employee-dialog-fields">
            <Field label="Mã nhân viên" required>
              <input className="erp-control" required value={draft.employeeCode} onChange={(event) => update("employeeCode", event.target.value)} />
            </Field>
            <Field label="Họ tên" required>
              <input className="erp-control" required value={draft.fullName} onChange={(event) => update("fullName", event.target.value)} />
            </Field>
            {mode === "create" ? <>
              <Field label="Bộ ca HC" required>
                <select className="erp-control" required value={draft.shiftTemplateId} onChange={(event) => update("shiftTemplateId", event.target.value)}>
                  <option value="">Chọn bộ ca</option>
                  {shifts.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Ngày hiệu lực" required>
                <input className="erp-control" type="date" required value={draft.effectiveFrom} onChange={(event) => update("effectiveFrom", event.target.value)} />
              </Field>
            </> : <label className="erp-employee-active"><input type="checkbox" checked={draft.isActive} onChange={(event) => update("isActive", event.target.checked)} /><span>Đang hoạt động</span></label>}
          </div>
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : mode === "create" ? "Tạo nhân viên" : "Lưu thay đổi"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
