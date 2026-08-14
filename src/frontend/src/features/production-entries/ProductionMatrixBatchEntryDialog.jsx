import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { isCurrentBatchOperationsRequest } from "./productionMatrixBatch.js";

const toNumber = (value) => value === "" ? null : Number(value);

export function firstActiveEmployeeId(employees = []) {
  const employee = employees.find((item) => item.isActive !== false);
  return employee?.id ? String(employee.id) : "";
}

export function ProductionMatrixBatchEntryDialog({ day, employees = [], onClose, onSaved }) {
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;
  const selectedIds = useMemo(() => Object.keys(drafts), [drafts]);

  useEffect(() => {
    if (!day) return;
    setEmployeeId(firstActiveEmployeeId(employees));
    setOrderId(""); setOperations([]); setDrafts({}); setError("");
    api.get("/api/lookups/production-orders/active").then(setOrders)
      .catch((requestError) => setError(requestError.message || "Không thể tải Mã SX."));
  }, [day, employees]);

  useEffect(() => {
    if (!day || !orderId) { setOperations([]); return; }
    let active = true;
    const requestedOrderId = orderId;
    setDrafts({});
    api.get(`/api/production-orders/${orderId}/operations`).then((items) => {
      if (isCurrentBatchOperationsRequest(active, requestedOrderId, orderIdRef.current)) setOperations(items);
    }).catch((requestError) => {
      if (isCurrentBatchOperationsRequest(active, requestedOrderId, orderIdRef.current)) setError(requestError.message || "Không thể tải công đoạn.");
    });
    return () => { active = false; };
  }, [day, orderId]);

  if (!day) return null;

  function toggle(operation) {
    const id = String(operation.id);
    setDrafts((current) => {
      if (current[id]) { const next = { ...current }; delete next[id]; return next; }
      return { ...current, [id]: { hc: "", tc: "", note: "" } };
    });
  }

  function change(id, key, value) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  async function save() {
    if (!employeeId) return setError("Hãy chọn nhân viên.");
    if (!orderId) return setError("Hãy chọn Mã SX.");
    if (!selectedIds.length) return setError("Hãy chọn ít nhất một công đoạn.");
    if (selectedIds.some((id) => drafts[id].hc === "" || drafts[id].tc === "")) return setError("Hãy nhập HC và TC cho tất cả công đoạn đã chọn.");
    setSaving(true); setError("");
    try {
      const result = await api.post("/api/production-entries/batch-direct", {
        workDate: day.isoDate, employeeId, productionOrderId: orderId,
        items: selectedIds.map((id) => ({ productionOperationId: id, directHcQuantity: toNumber(drafts[id].hc), directTcQuantity: toNumber(drafts[id].tc), note: drafts[id].note.trim() || null })),
      });
      onSaved?.(result);
    } catch (requestError) { setError(requestError.message || "Không thể lưu nhiều công đoạn."); }
    finally { setSaving(false); }
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-matrix-batch-dialog" role="dialog" aria-modal="true" aria-labelledby="matrix-batch-title">
        <h2 id="matrix-batch-title">Nhập nhanh sản lượng — {day.weekdayLabel} {day.displayDate}</h2>
        <div className="erp-dialog-body">
          <div className="erp-matrix-input-grid erp-matrix-batch-fields">
            <label><span>Ngày</span><input className="erp-control" value={day.isoDate} readOnly /></label>
            <label><span>Nhân viên</span><select className="erp-control" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Chọn nhân viên</option>{employees.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></label>
            <label><span>Mã SX</span><select className="erp-control" value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Chọn Mã SX</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}</select></label>
          </div>
          <div className="erp-matrix-operation-picker" role="group" aria-label="Chọn nhiều công đoạn">{operations.map((operation) => <button key={operation.id} type="button" className="erp-button erp-button-secondary" aria-pressed={Boolean(drafts[String(operation.id)])} onClick={() => toggle(operation)}>CĐ{operation.operationNumber}</button>)}</div>
          {selectedIds.length > 0 && <div className="erp-matrix-batch-table-wrap"><table className="erp-matrix-batch-table"><thead><tr><th>CĐ</th><th>HC</th><th>TC</th><th>Ghi chú</th><th /></tr></thead><tbody>{selectedIds.map((id) => { const operation = operations.find((item) => String(item.id) === id); return <tr key={id}><td><strong>CĐ{operation?.operationNumber}</strong></td><td><input className="erp-control" type="number" min="0" required value={drafts[id].hc} onChange={(event) => change(id, "hc", event.target.value)} /></td><td><input className="erp-control" type="number" min="0" required value={drafts[id].tc} onChange={(event) => change(id, "tc", event.target.value)} /></td><td><input className="erp-control" value={drafts[id].note} onChange={(event) => change(id, "note", event.target.value)} /></td><td><button type="button" className="erp-button erp-button-link" onClick={() => toggle(operation)}>Bỏ</button></td></tr>; })}</tbody></table></div>}
          {error && <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>}
        </div>
        <div className="erp-dialog-actions"><button type="button" className="erp-button erp-button-secondary" onClick={onClose}>Hủy</button><button type="button" className="erp-button erp-button-primary" disabled={saving || !selectedIds.length} onClick={save}>{saving ? "Đang lưu..." : `Lưu ${selectedIds.length} công đoạn`}</button></div>
      </section>
    </div>
  );
}
