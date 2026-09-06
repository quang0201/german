import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { buildUserAccountCreatePayload, buildUserAccountUpdatePayload, userAccountForm } from "./userAccountDialog.js";
import "./UserAccountDialog.css";

export function UserAccountDialog({ open = false, mode = "create", account = null, employees = [], assignedIds = new Set(), loading = false, error = "", onClose, onSubmit, onChange }) {
  const [draft, setDraft] = useState(() => userAccountForm(account ?? {}));

  useEffect(() => {
    if (open) setDraft(userAccountForm(account ?? {}));
  }, [open, account]);

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
  const availableEmployees = employees.filter((item) => item.isActive !== false && (!assignedIds.has(String(item.id)) || String(item.id) === String(account?.employeeId)));

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    onChange?.();
  }

  function submit(event) {
    event.preventDefault();
    onSubmit?.(editing ? buildUserAccountUpdatePayload(draft) : buildUserAccountCreatePayload(draft));
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-user-account-dialog" role="dialog" aria-modal="true" aria-labelledby="user-account-dialog-title">
        <div className="erp-user-account-dialog-header">
          <h2 id="user-account-dialog-title">{editing ? "Sửa tài khoản" : "Tạo tài khoản"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể lưu tài khoản.">{error}</Alert>}
        <form onSubmit={submit}>
          <div className="erp-user-account-dialog-fields">
            <Field label="Tên đăng nhập" required>
              <input className="erp-control" required value={draft.username} onChange={(event) => update("username", event.target.value)} />
            </Field>
            <Field label="Mật khẩu" required={!editing} hint={editing ? "Để trống nếu không đổi mật khẩu." : "Ít nhất 8 ký tự."}>
              <input className="erp-control" required={!editing} minLength="8" type="password" value={draft.password} onChange={(event) => update("password", event.target.value)} />
            </Field>
            <Field label="Vai trò">
              <select className="erp-control" value={draft.role} onChange={(event) => update("role", event.target.value)}>
                <option value="Worker">Công nhân</option>
                <option value="Manager">Quản lý</option>
                <option value="Admin">Quản trị viên</option>
              </select>
            </Field>
            <Field label="Gắn nhân viên" required={draft.role === "Worker"}>
              <select className="erp-control" required={draft.role === "Worker"} value={draft.employeeId} onChange={(event) => update("employeeId", event.target.value)}>
                <option value="">Không gắn</option>
                {availableEmployees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}
              </select>
            </Field>
            {editing && <label className="erp-user-account-active"><input type="checkbox" checked={draft.isActive} onChange={(event) => update("isActive", event.target.checked)} /><span>Đang hoạt động</span></label>}
          </div>
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo mới"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
