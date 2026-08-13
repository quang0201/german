import React, { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

function asNumber(value) {
  return value === "" ? null : Number(value);
}

export function ProductionMatrixQuickEntryDialog({ context, onClose, onSaved }) {
  const record = context?.cell?.entryCount === 1 ? context.cell.records?.[0] : null;
  const editing = record?.entryMode === "Direct";
  const [hc, setHc] = useState("");
  const [tc, setTc] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!context) return;
    setHc(editing ? String(context.cell.hcQuantity ?? "") : "");
    setTc(editing ? String(context.cell.tcQuantity ?? "") : "");
    setNote(editing ? (record?.note ?? "") : "");
    setError("");
    setConfirmDelete(false);
  }, [context, editing, record?.note]);

  if (!context) return null;

  const payload = {
    workDate: context.workDate,
    employeeId: context.employee.employeeId,
    productionOrderId: context.order.orderId,
    productionOperationId: context.operation.operationId,
    entryMode: "Direct",
    shift1Quantity: null,
    shift2Quantity: null,
    directHcQuantity: asNumber(hc),
    directTcQuantity: asNumber(tc),
    totalInputQuantity: null,
    overtimeHours: null,
    overtimeQuantity: null,
    workStart: null,
    workEnd: null,
    note: note.trim() || null,
  };

  async function save() {
    setSaving(true); setError("");
    try {
      if (editing) await api.put(`/api/production-entries/${record.id}`, { ...payload, version: record.version });
      else await api.post("/api/production-entries", payload);
      onSaved?.();
    } catch (requestError) {
      setError(requestError.message || "Không thể lưu sản lượng.");
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true); setError("");
    try {
      await api.delete(`/api/production-entries/${record.id}?version=${record.version}`);
      onSaved?.();
    } catch (requestError) {
      setError(requestError.message || "Không thể xóa sản lượng.");
    } finally { setSaving(false); }
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-matrix-dialog" role="dialog" aria-modal="true" aria-labelledby="matrix-quick-title">
        <h2 id="matrix-quick-title">{editing ? "Chỉnh sửa sản lượng" : "Nhập sản lượng"}</h2>
        <div className="erp-dialog-body">
          <div className="erp-matrix-readonly-grid">
            <div><span>Nhân viên</span><strong>{context.employee.employeeName}</strong></div>
            <div><span>Mã SX</span><strong>{context.order.orderCode}</strong></div>
            <div><span>Công đoạn</span><strong>CĐ{context.operation.operationNumber}</strong></div>
            <div><span>Ngày</span><strong>{context.workDate.split("-").reverse().join("/")}</strong></div>
          </div>
          <div className="erp-matrix-input-grid">
            <label><span>HC</span><input className="erp-control" type="number" min="0" value={hc} onChange={(event) => setHc(event.target.value)} /></label>
            <label><span>TC</span><input className="erp-control" type="number" min="0" value={tc} onChange={(event) => setTc(event.target.value)} /></label>
            <label className="erp-matrix-field-wide"><span>Ghi chú</span><input className="erp-control" value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </div>
          {error && <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>}
          {confirmDelete && <p className="erp-inline-message erp-inline-error">Bấm Xóa lần nữa để xác nhận.</p>}
        </div>
        <div className="erp-dialog-actions erp-matrix-dialog-actions">
          {editing && <button type="button" className="erp-button erp-button-danger" disabled={saving} onClick={remove}>Xóa</button>}
          <span className="erp-matrix-action-spacer" />
          <button type="button" className="erp-button erp-button-secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="erp-button erp-button-primary" disabled={saving} onClick={save}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </section>
    </div>
  );
}
