import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { buildBatchDirectPayload, isCurrentAttendanceRequest, isCurrentBatchOperationsRequest, isCurrentBatchOrdersRequest, mergeAttendanceHourDraft, resolveBatchEntryQuantities } from "./productionMatrixBatch.js";

const INPUT_MODES = [
  { value: "direct", label: "Nhập trực tiếp" },
  { value: "total-hours", label: "Theo tổng giờ" },
  { value: "attendance-shifts", label: "Theo ca chấm công" },
];

const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const emptyHourDraft = () => ({ hcHours: "", tcHours: "0", shifts: [] });
const emptyOperationDraft = () => ({ hc: "", tc: "", total: "", note: "" });

export function firstActiveEmployeeId(employees = []) {
  const employee = employees.find((item) => item.isActive !== false);
  return employee?.id ? String(employee.id) : "";
}

export function initialBatchEmployeeId(employees = [], preferredEmployeeId = "") {
  if (employees.some((item) => item.isActive !== false && String(item.id) === String(preferredEmployeeId))) {
    return String(preferredEmployeeId);
  }
  return firstActiveEmployeeId(employees);
}

export function initialBatchOrderId(orders = [], preferredOrderId = "") {
  return orders.some((item) => String(item.id) === String(preferredOrderId)) ? String(preferredOrderId) : "";
}

export function ProductionMatrixBatchEntryDialog({ day, employees = [], onClose, onSaved }) {
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [inputMode, setInputMode] = useState("attendance-shifts");
  const [hourDraft, setHourDraft] = useState(emptyHourDraft);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const orderIdRef = useRef(orderId);
  const dayRef = useRef(day);
  const employeeIdRef = useRef(employeeId);
  const attendanceDirtyRef = useRef({ hcHours: false, tcHours: false, shifts: {} });
  orderIdRef.current = orderId;
  dayRef.current = day;
  employeeIdRef.current = employeeId;
  const selectedIds = useMemo(() => Object.keys(drafts), [drafts]);

  useEffect(() => {
    if (!day) return undefined;
    let active = true;
    const requestedDay = day;
    setEmployeeId(initialBatchEmployeeId(employees, requestedDay.preferredEmployeeId));
    setOrderId("");
    setOrders([]);
    setOperations([]);
    setInputMode("attendance-shifts");
    setHourDraft(emptyHourDraft());
    setDrafts({});
    setError("");
    api.get("/api/lookups/production-orders/active")
      .then((items) => {
      if (!isCurrentBatchOrdersRequest(active, requestedDay, dayRef.current)) return;
      setOrders(items);
      setOrderId(initialBatchOrderId(items, requestedDay.preferredOrderId));
    })
      .catch((requestError) => {
        if (isCurrentBatchOrdersRequest(active, requestedDay, dayRef.current)) setError(requestError.message || "Không thể tải Mã SX.");
      });
    return () => { active = false; };
  }, [day, employees]);

  useEffect(() => {
    if (!day || !orderId) { setOperations([]); setOperationsLoading(false); return undefined; }
    let active = true;
    const requestedOrderId = orderId;
    setOperations([]);
    setDrafts({});
    setError("");
    setOperationsLoading(true);
    api.get(`/api/production-orders/${orderId}/operations`)
      .then((items) => {
        if (isCurrentBatchOperationsRequest(active, requestedOrderId, orderIdRef.current)) setOperations(items);
      })
      .catch((requestError) => {
        if (isCurrentBatchOperationsRequest(active, requestedOrderId, orderIdRef.current)) setError(requestError.message || "Không thể tải công đoạn.");
      })
      .finally(() => {
        if (isCurrentBatchOperationsRequest(active, requestedOrderId, orderIdRef.current)) setOperationsLoading(false);
      });
    return () => { active = false; };
  }, [day, orderId]);

  useEffect(() => {
    if (!day || !employeeId) {
      setHourDraft(emptyHourDraft());
      setAttendanceLoading(false);
      return undefined;
    }
    let active = true;
    const requestedEmployeeId = employeeId;
    const requestedDate = day.isoDate;
    attendanceDirtyRef.current = { hcHours: false, tcHours: false, shifts: {} };
    setHourDraft(emptyHourDraft());
    setAttendanceLoading(true);
    api.get(`/api/lookups/attendance-hours?employeeId=${encodeURIComponent(requestedEmployeeId)}&date=${encodeURIComponent(requestedDate)}`)
      .then((attendance) => {
        if (!isCurrentAttendanceRequest(active, requestedEmployeeId, requestedDate, employeeIdRef.current, dayRef.current?.isoDate)) return;
        setHourDraft((current) => mergeAttendanceHourDraft(current, attendance, attendanceDirtyRef.current));
      })
      .catch((requestError) => {
        if (isCurrentAttendanceRequest(active, requestedEmployeeId, requestedDate, employeeIdRef.current, dayRef.current?.isoDate)) {
          setError(requestError.message || "Không thể tải giờ chấm công.");
        }
      })
      .finally(() => {
        if (isCurrentAttendanceRequest(active, requestedEmployeeId, requestedDate, employeeIdRef.current, dayRef.current?.isoDate)) setAttendanceLoading(false);
      });
    return () => { active = false; };
  }, [day, employeeId]);

  if (!day) return null;

  function toggle(operation) {
    const id = String(operation.id);
    setDrafts((current) => {
      if (current[id]) { const next = { ...current }; delete next[id]; return next; }
      return { ...current, [id]: emptyOperationDraft() };
    });
  }

  function change(id, key, value) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  function changeHour(key, value) {
    attendanceDirtyRef.current[key] = true;
    setHourDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function changeShiftHour(slotNumber, value) {
    attendanceDirtyRef.current.shifts[String(slotNumber)] = true;
    setHourDraft((current) => ({
      ...current,
      shifts: current.shifts.map((shift) => String(shift.slotNumber) === String(slotNumber) ? { ...shift, workedHours: value } : shift),
    }));
    setError("");
  }

  function selectEmployee(value) {
    setEmployeeId(value);
    setDrafts({});
    setError("");
  }

  function previewFor(draft) {
    if (inputMode === "direct") return null;
    try {
      return resolveBatchEntryQuantities({ mode: inputMode, draft, hourDraft }).preview;
    } catch {
      return null;
    }
  }

  async function save() {
    if (!employeeId) return setError("Hãy chọn nhân viên.");
    if (!orderId) return setError("Hãy chọn Mã SX.");
    if (!selectedIds.length) return setError("Hãy chọn ít nhất một công đoạn.");
    let items;
    try {
      items = selectedIds.map((id) => {
        const quantities = resolveBatchEntryQuantities({ mode: inputMode, draft: drafts[id], hourDraft });
        return {
          productionOperationId: id,
          directHcQuantity: quantities.hc,
          directTcQuantity: quantities.tc,
          note: drafts[id].note.trim() || null,
        };
      });
    } catch (validationError) {
      return setError(validationError.message);
    }
    setSaving(true); setError("");
    try {
      const result = await api.post("/api/production-entries/batch-direct", buildBatchDirectPayload({
        workDate: day.isoDate,
        employeeId,
        productionOrderId: orderId,
        hourDraft: inputMode === "attendance-shifts" ? hourDraft : null,
        items,
      }));
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
            <label><span>Nhân viên *</span><select className="erp-control" required value={employeeId} onChange={(event) => selectEmployee(event.target.value)}><option value="">Chọn nhân viên</option>{employees.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></label>
            <label><span>Bước 1: Chọn Mã SX *</span><select className="erp-control" required value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Chọn Mã SX</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}</select></label>
          </div>
          <div className="erp-matrix-operation-picker" role="group" aria-label="Bước 2: Chọn công đoạn">
            <strong>Bước 2: Chọn công đoạn</strong>
            {!orderId && <span>Chọn Mã SX ở bước 1 để tải công đoạn.</span>}
            {orderId && operationsLoading && <span>Đang tải công đoạn...</span>}
            {orderId && !operationsLoading && !operations.length && <span>Mã SX này chưa có công đoạn hoạt động.</span>}
            {operations.map((operation) => <button key={operation.id} type="button" className="erp-button erp-button-secondary" aria-pressed={Boolean(drafts[String(operation.id)])} onClick={() => toggle(operation)}>CĐ{operation.operationNumber} — {operation.name}</button>)}
          </div>
          <div className="erp-matrix-batch-mode-picker" role="group" aria-label="Kiểu nhập batch">
            {INPUT_MODES.map((mode) => <button key={mode.value} type="button" className={`erp-button erp-button-secondary ${inputMode === mode.value ? "is-selected" : ""}`} aria-pressed={inputMode === mode.value} onClick={() => { setInputMode(mode.value); setError(""); }}>{mode.label}</button>)}
          </div>
          {inputMode !== "direct" && <div className="erp-matrix-batch-hours" aria-label="Giờ phân bổ">
            {inputMode === "total-hours" && <><label><span>Giờ HC</span><input className="erp-control" type="number" min="0" step="any" value={hourDraft.hcHours} onChange={(event) => changeHour("hcHours", event.target.value)} /></label><label><span>Giờ TC</span><input className="erp-control" type="number" min="0" step="any" value={hourDraft.tcHours} onChange={(event) => changeHour("tcHours", event.target.value)} /></label></>}
            {inputMode === "attendance-shifts" && <>{hourDraft.shifts.map((shift) => <label key={shift.slotNumber}><span>{shift.shiftName}</span><input className="erp-control" type="number" min="0" step="any" value={shift.workedHours} onChange={(event) => changeShiftHour(shift.slotNumber, event.target.value)} /></label>)}<label><span>TC</span><input className="erp-control" type="number" min="0" step="any" value={hourDraft.tcHours} onChange={(event) => changeHour("tcHours", event.target.value)} /></label>{!attendanceLoading && !hourDraft.shifts.length && <span className="erp-matrix-batch-empty-hours">Chưa có ca chấm công; hãy nhập theo tổng giờ hoặc nhập trực tiếp.</span>}</>}
            {attendanceLoading && <span>Đang tải giờ chấm công...</span>}
          </div>}
          {selectedIds.length > 0 && <div className="erp-matrix-batch-table-wrap"><table className="erp-matrix-batch-table"><thead><tr><th>CĐ</th>{inputMode === "direct" ? <><th>HC</th><th>TC</th></> : <><th>Tổng SL</th>{inputMode === "attendance-shifts" && hourDraft.shifts.map((shift) => <th key={shift.slotNumber}>{shift.shiftName}</th>)}<th>TC</th><th>HC tổng</th><th>TC tổng</th></>}<th>Ghi chú</th><th /></tr></thead><tbody>{selectedIds.map((id) => { const operation = operations.find((item) => String(item.id) === id); const draft = drafts[id]; const preview = previewFor(draft); return <tr key={id}><td><strong>CĐ{operation?.operationNumber}</strong></td>{inputMode === "direct" ? <><td><input className="erp-control" type="number" min="0" required value={draft.hc} onChange={(event) => change(id, "hc", event.target.value)} /></td><td><input className="erp-control" type="number" min="0" required value={draft.tc} onChange={(event) => change(id, "tc", event.target.value)} /></td></> : <><td><input className="erp-control" inputMode="decimal" required value={draft.total} onChange={(event) => change(id, "total", event.target.value)} placeholder="Ví dụ: 300+100" /></td>{inputMode === "attendance-shifts" && hourDraft.shifts.map((shift) => <td key={shift.slotNumber}><span className="erp-matrix-preview-value">{preview ? quantityFormat.format(preview.shifts.find((item) => String(item.slotNumber) === String(shift.slotNumber))?.quantity ?? 0) : "—"}</span></td>)}<td><span className="erp-matrix-preview-value">{preview ? quantityFormat.format(preview.tc) : "—"}</span></td><td><span className="erp-matrix-preview-value">{preview ? quantityFormat.format(preview.hc) : "—"}</span></td><td><span className="erp-matrix-preview-value">{preview ? quantityFormat.format(preview.tc) : "—"}</span></td></>}<td><input className="erp-control" value={draft.note} onChange={(event) => change(id, "note", event.target.value)} /></td><td><button type="button" className="erp-button erp-button-link" onClick={() => toggle(operation)}>Bỏ</button></td></tr>; })}</tbody></table></div>}
          {error && <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>}
        </div>
        <div className="erp-dialog-actions"><button type="button" className="erp-button erp-button-secondary" onClick={onClose}>Hủy</button><button type="button" className="erp-button erp-button-primary" disabled={saving || !selectedIds.length} onClick={save}>{saving ? "Đang lưu..." : `Lưu ${selectedIds.length} công đoạn`}</button></div>
      </section>
    </div>
  );
}
