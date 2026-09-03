import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { buildEmployeeCreatePayload, employeeCreateForm } from "./employeeCreate.js";
import { buildEmployeeShiftAssignmentPayload, buildEmployeeUpdatePayload, employeeForm } from "./employeeDialog.js";
import "./EmployeeDialog.css";

function formatEmployeeDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

export function EmployeeDialog({ open = false, mode = "edit", employee = null, shifts = [], shiftLoading = false, loading = false, assignmentLoading = false, error = "", assignmentError = "", onClose, onSubmit, onAssignShift, onChange }) {
  const [draft, setDraft] = useState(() => mode === "create" ? employeeCreateForm() : employeeForm(employee ?? {}));
  const [assignmentDraft, setAssignmentDraft] = useState({ shiftTemplateId: "", effectiveFrom: "" });
  const [assignmentValidationError, setAssignmentValidationError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(mode === "create" ? employeeCreateForm() : employeeForm(employee ?? {}));
      setAssignmentDraft({ shiftTemplateId: "", effectiveFrom: "" });
      setAssignmentValidationError("");
    }
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

  const canAssignShift = employee?.isActive !== false && draft.isActive;

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    onChange?.();
  }

  function submit(event) {
    event.preventDefault();
    onSubmit?.(mode === "create" ? buildEmployeeCreatePayload(draft) : buildEmployeeUpdatePayload(draft));
  }

  async function assignShift() {
    if (!canAssignShift) return;
    if (!assignmentDraft.shiftTemplateId || !assignmentDraft.effectiveFrom) {
      setAssignmentValidationError("Hãy chọn bộ ca và ngày hiệu lực.");
      return;
    }
    setAssignmentValidationError("");
    const succeeded = await onAssignShift?.(buildEmployeeShiftAssignmentPayload(assignmentDraft));
    if (succeeded !== false) setAssignmentDraft({ shiftTemplateId: "", effectiveFrom: "" });
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
            {mode === "edit" && <div className="erp-employee-dialog-section-heading"><h3>Thông tin nhân viên</h3></div>}
            <Field label="Mã nhân viên" required>
              <input className="erp-control" required value={draft.employeeCode} onChange={(event) => update("employeeCode", event.target.value)} />
            </Field>
            <Field label="Họ tên" required>
              <input className="erp-control" required value={draft.fullName} onChange={(event) => update("fullName", event.target.value)} />
            </Field>
            {mode === "create" ? <>
              <Field label="Bộ ca HC" required>
                <select className="erp-control" required disabled={shiftLoading} value={draft.shiftTemplateId} onChange={(event) => update("shiftTemplateId", event.target.value)}>
                  <option value="">{shiftLoading ? "Đang tải bộ ca..." : "Chọn bộ ca"}</option>
                  {shifts.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Ngày hiệu lực" required>
                <input className="erp-control" type="date" required value={draft.effectiveFrom} onChange={(event) => update("effectiveFrom", event.target.value)} />
              </Field>
            </> : <>
              <label className="erp-employee-active"><input type="checkbox" checked={draft.isActive} onChange={(event) => update("isActive", event.target.checked)} /><span>Đang hoạt động</span></label>
              <div className="erp-employee-current-shift-section">
                <div className="erp-employee-dialog-section-heading">
                  <h3>Bộ ca đang áp dụng hôm nay</h3>
                  <p>Thông tin ca hiệu lực theo ngày hiện tại.</p>
                </div>
                {employee?.currentShiftTemplateName ? <div className="erp-employee-current-shift-card"><strong>{employee.currentShiftTemplateName}</strong><span>Ngày hiệu lực: {formatEmployeeDate(employee.currentShiftEffectiveFrom)}</span></div> : <Alert variant="warning" title="Chưa gán bộ ca.">Nhân viên chưa có bộ ca áp dụng cho hôm nay.</Alert>}
              </div>
              {onAssignShift && <div className="erp-employee-shift-section">
                <div className="erp-employee-shift-section-heading">
                  <div>
                    <h3>Đổi bộ ca mới</h3>
                    <p>Lịch sử ca cũ được giữ nguyên. Bộ ca mới áp dụng từ ngày bạn chọn.</p>
                  </div>
                </div>
                {assignmentError && <Alert variant="error" title="Không thể gán bộ ca.">{assignmentError}</Alert>}
                {assignmentValidationError && <Alert variant="error" title="Thiếu thông tin bộ ca.">{assignmentValidationError}</Alert>}
                <div className="erp-employee-shift-fields">
                  <Field label="Bộ ca mới" required>
                    <select className="erp-control" value={assignmentDraft.shiftTemplateId} disabled={shiftLoading || assignmentLoading || !canAssignShift} onChange={(event) => { setAssignmentDraft((current) => ({ ...current, shiftTemplateId: event.target.value })); setAssignmentValidationError(""); }}>
                      <option value="">{shiftLoading ? "Đang tải bộ ca..." : "Chọn bộ ca"}</option>
                      {shifts.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Ngày hiệu lực" required>
                    <input className="erp-control" type="date" value={assignmentDraft.effectiveFrom} disabled={!assignmentDraft.shiftTemplateId || assignmentLoading || !canAssignShift} onChange={(event) => { setAssignmentDraft((current) => ({ ...current, effectiveFrom: event.target.value })); setAssignmentValidationError(""); }} />
                  </Field>
                </div>
                <button type="button" className="erp-button erp-button-secondary" disabled={assignmentLoading || shiftLoading || !canAssignShift} onClick={assignShift}>{assignmentLoading ? "Đang gán ca..." : "Gán bộ ca mới"}</button>
                {!canAssignShift && <p className="erp-field-hint">Nhân viên đã tắt không thể gán ca mới.</p>}
              </div>}
            </>}
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
