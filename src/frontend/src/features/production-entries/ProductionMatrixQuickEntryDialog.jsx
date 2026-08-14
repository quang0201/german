import React, { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { isVersionConflict, mapProductionEntryError } from "./productionEntryErrors.js";
import "./ProductionMatrixDialogs.css";

function asNumber(value) {
  return value === "" ? null : Number(value);
}

export function ProductionMatrixQuickEntryDialog({ context, onClose, onSaved, onReload }) {
  const record = context?.cell?.entryCount === 1 ? context.cell.records?.[0] : null;
  const editing = record?.entryMode === "Direct";
  const [hc, setHc] = useState("");
  const [tc, setTc] = useState("");
  const [note, setNote] = useState("");
  const [editEntry, setEditEntry] = useState(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!context) return undefined;
    let active = true;
    setHc(editing ? String(context.cell.hcQuantity ?? "") : "");
    setTc(editing ? String(context.cell.tcQuantity ?? "") : "");
    setNote(editing ? (record?.note ?? "") : "");
    setEditEntry(null);
    setError("");
    setConflict(false);
    setConfirmDelete(false);
    if (!editing) return () => { active = false; };

    setLoadingEntry(true);
    api.get(`/api/production-entries/${record.id}`)
      .then((entry) => {
        if (!active) return;
        setEditEntry(entry);
        setHc(String(entry.directHcQuantity ?? entry.hcQuantity ?? ""));
        setTc(String(entry.directTcQuantity ?? entry.tcQuantity ?? ""));
        setNote(entry.note ?? "");
      })
      .catch((requestError) => active && setError(mapProductionEntryError(requestError, "Không thể tải bản ghi để chỉnh sửa.")))
      .finally(() => active && setLoadingEntry(false));
    return () => { active = false; };
  }, [context, editing, record?.id, record?.note]);

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
    workStart: editEntry?.workStart ?? null,
    workEnd: editEntry?.workEnd ?? null,
    note: note.trim() || null,
  };

  async function save() {
    if (hc === "" || tc === "") {
      setError("Hãy nhập HC và TC.");
      return;
    }
    setSaving(true); setError(""); setConflict(false);
    try {
      if (editing) await api.put(`/api/production-entries/${record.id}`, { ...payload, version: editEntry?.version ?? record.version });
      else await api.post("/api/production-entries", payload);
      onSaved?.();
    } catch (requestError) {
      setConflict(isVersionConflict(requestError));
      setError(mapProductionEntryError(requestError, "Không thể lưu sản lượng."));
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true); setError(""); setConflict(false);
    try {
      await api.delete(`/api/production-entries/${record.id}?version=${editEntry?.version ?? record.version}`);
      onSaved?.();
    } catch (requestError) {
      setConflict(isVersionConflict(requestError));
      setError(mapProductionEntryError(requestError, "Không thể xóa sản lượng."));
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
            <label><span>HC</span><input className="erp-control" type="number" min="0" required value={hc} onChange={(event) => setHc(event.target.value)} /></label>
            <label><span>TC</span><input className="erp-control" type="number" min="0" required value={tc} onChange={(event) => setTc(event.target.value)} /></label>
            <label className="erp-matrix-field-wide"><span>Ghi chú</span><input className="erp-control" value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </div>
          {loadingEntry && <p className="erp-inline-message">Đang tải dữ liệu gốc...</p>}
          {error && <div className="erp-inline-message erp-inline-error" role="alert"><span>{error}</span>{conflict && <button type="button" className="erp-button erp-button-secondary" onClick={onReload}>Tải lại dữ liệu</button>}</div>}
          {confirmDelete && <p className="erp-inline-message erp-inline-error">Bấm Xóa lần nữa để xác nhận.</p>}
        </div>
        <div className="erp-dialog-actions erp-matrix-dialog-actions">
          {editing && <button type="button" className="erp-button erp-button-danger" disabled={saving || loadingEntry} onClick={remove}>Xóa</button>}
          <span className="erp-matrix-action-spacer" />
          <button type="button" className="erp-button erp-button-secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="erp-button erp-button-primary" disabled={saving || loadingEntry} onClick={save}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </section>
    </div>
  );
}
