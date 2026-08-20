import React, { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../app/navigation.js";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { calculatePreview } from "./productionCalculation.js";
import { ProductionEntryPreview } from "./ProductionEntryPreview.jsx";
import { attendanceHoursDefaults } from "./productionAttendanceHours.js";
import { isVersionConflict, mapProductionEntryError } from "./productionEntryErrors.js";
import { productionOrderLookupPath } from "./productionOrderLookup.js";

const MODES = [
  { value: "ByShift", label: "Theo ca", description: "Ca 1 + Ca 2, TC tự tính nếu chỉ nhập giờ." },
  { value: "Direct", label: "HC / TC trực tiếp", description: "Nhập trực tiếp sản lượng HC và TC." },
  { value: "TotalWithOvertime", label: "Tổng + giờ TC", description: "Nhập tổng, hệ thống tách HC và TC." },
];

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function numberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function initialState(entry, session) {
  return {
    workDate: entry?.workDate ?? localToday(),
    employeeId: String(entry?.employeeId ?? session?.employeeId ?? ""),
    orderId: String(entry?.productionOrderId ?? ""),
    operationId: String(entry?.productionOperationId ?? ""),
    mode: entry?.entryMode ?? "ByShift",
    shift1Quantity: entry?.shift1Quantity ?? "",
    shift2Quantity: entry?.shift2Quantity ?? "",
    directHcQuantity: entry?.directHcQuantity ?? "",
    directTcQuantity: entry?.directTcQuantity ?? "",
    totalQuantity: entry?.totalInputQuantity ?? "",
    overtimeHours: entry?.overtimeHours ?? "",
    overtimeQuantity: entry?.overtimeQuantity ?? "",
    workStart: entry?.workStart ?? "",
    workEnd: entry?.workEnd ?? "",
    note: entry?.note ?? "",
  };
}

function toPayload(form, hcHours) {
  return {
    workDate: form.workDate,
    employeeId: form.employeeId,
    productionOrderId: form.orderId,
    productionOperationId: form.operationId,
    entryMode: form.mode,
    shift1Quantity: form.mode === "ByShift" ? numberOrNull(form.shift1Quantity) : null,
    shift2Quantity: form.mode === "ByShift" ? numberOrNull(form.shift2Quantity) : null,
    directHcQuantity: form.mode === "Direct" ? numberOrNull(form.directHcQuantity) : null,
    directTcQuantity: form.mode === "Direct" ? numberOrNull(form.directTcQuantity) : null,
    totalInputQuantity: form.mode === "TotalWithOvertime" ? numberOrNull(form.totalQuantity) : null,
    overtimeHours: form.mode !== "Direct" ? numberOrNull(form.overtimeHours) : null,
    overtimeQuantity: form.mode === "ByShift" ? numberOrNull(form.overtimeQuantity) : null,
    hcHours: form.mode !== "Direct" ? numberOrNull(hcHours) : null,
    workStart: form.workStart || null,
    workEnd: form.workEnd || null,
    note: form.note.trim() || null,
  };
}

export function ProductionEntryFormPage({ session, entry = null, onSaved, onCancel, inPanel = false }) {
  const editing = Boolean(entry?.id);
  const [form, setForm] = useState(() => initialState(entry, session));
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [hcHours, setHcHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [serverResult, setServerResult] = useState(null);
  const [attendanceLookupVersion, setAttendanceLookupVersion] = useState(0);
  const intentRef = useRef("save");
  const attendanceHoursEditedRef = useRef(false);
  const toast = useToast();
  const canChooseEmployee = session?.role === "Manager" || session?.role === "Admin";

  useEffect(() => {
    let active = true;
    const requests = [api.get(productionOrderLookupPath(canChooseEmployee))];
    if (canChooseEmployee) requests.push(api.get("/api/employees"));
    Promise.all(requests)
      .then(([activeOrders, employeeRows]) => {
        if (!active) return;
        const nextOrders = [...activeOrders];
        if (entry?.productionOrderId && !nextOrders.some((item) => String(item.id) === String(entry.productionOrderId))) {
          nextOrders.unshift({ id: entry.productionOrderId, code: entry.productionOrderCode, productName: entry.productName });
        }
        setOrders(nextOrders);
        if (!entry?.productionOrderId && !form.orderId && nextOrders[0]) setForm((current) => ({ ...current, orderId: String(nextOrders[0].id) }));
        if (canChooseEmployee) {
          const activeEmployees = (employeeRows ?? []).filter((item) => item.isActive !== false);
          setEmployees(activeEmployees);
          if (!entry?.employeeId && !form.employeeId && activeEmployees[0]) setForm((current) => ({ ...current, employeeId: String(activeEmployees[0].id) }));
        }
      })
      .catch((requestError) => active && setError(mapProductionEntryError(requestError, "Không thể tải dữ liệu nhập sản lượng.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canChooseEmployee, entry, session]);

  useEffect(() => {
    if (!form.orderId) {
      setOperations([]);
      return undefined;
    }
    let active = true;
    api.get(`/api/production-orders/${form.orderId}/operations`)
      .then((items) => {
        if (!active) return;
        setOperations(items);
        if (!form.operationId || !items.some((item) => String(item.id) === String(form.operationId))) {
          setForm((current) => ({ ...current, operationId: items[0] ? String(items[0].id) : "" }));
        }
      })
      .catch((requestError) => active && setError(mapProductionEntryError(requestError, "Không thể tải công đoạn.")));
    return () => { active = false; };
  }, [form.orderId, form.operationId]);

  useEffect(() => {
    if (!form.employeeId || !form.workDate) {
      setHcHours("");
      return undefined;
    }
    let active = true;
    attendanceHoursEditedRef.current = false;
    if (editing) {
      if (entry?.hcHours !== null && entry?.hcHours !== undefined) {
        setHcHours(String(entry.hcHours));
        return () => { active = false; };
      }
      api.get(`/api/lookups/hc-hours?employeeId=${encodeURIComponent(form.employeeId)}&date=${encodeURIComponent(form.workDate)}`)
        .then((result) => active && setHcHours(result.hcHours))
        .catch(() => active && setHcHours(""));
      return () => { active = false; };
    }

    setHcHours("");
    api.get(`/api/lookups/attendance-hours?employeeId=${encodeURIComponent(form.employeeId)}&date=${encodeURIComponent(form.workDate)}`)
      .then((result) => {
        if (!active || attendanceHoursEditedRef.current) return;
        const defaults = attendanceHoursDefaults({
          hasAttendance: result.hasAttendance,
          regularHours: result.regularHours,
          overtimeHours: result.overtimeHours,
        });
        setHcHours(defaults.hcHours);
        setForm((current) => ({ ...current, overtimeHours: defaults.tcHours }));
      })
      .catch(() => {
        if (!active || attendanceHoursEditedRef.current) return;
        const defaults = attendanceHoursDefaults(null);
        setHcHours(defaults.hcHours);
        setForm((current) => ({ ...current, overtimeHours: defaults.tcHours }));
      });
    return () => { active = false; };
  }, [editing, form.employeeId, form.workDate, attendanceLookupVersion]);

  const preview = useMemo(() => {
    try {
      return calculatePreview({ mode: form.mode, hcHours, shift1Quantity: form.shift1Quantity, shift2Quantity: form.shift2Quantity, directHcQuantity: form.directHcQuantity, directTcQuantity: form.directTcQuantity, totalQuantity: form.totalQuantity, overtimeHours: form.overtimeHours, overtimeQuantity: form.overtimeQuantity });
    } catch {
      return null;
    }
  }, [form, hcHours]);

  function update(key, value) {
    if (key === "overtimeHours") attendanceHoursEditedRef.current = true;
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setConflict(false);
    setServerResult(null);
  }

  function updateHcHours(value) {
    attendanceHoursEditedRef.current = true;
    setHcHours(value);
    setError("");
    setConflict(false);
    setServerResult(null);
  }

  function cancel() {
    if (onCancel) onCancel();
    else navigate("/production");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!form.employeeId) return setError("Hãy chọn nhân viên.");
    if (!form.orderId || !form.operationId) return setError("Hãy chọn mã sản xuất và công đoạn.");
    if (form.mode !== "Direct" && Number(form.overtimeHours || 0) > 0 && Number(hcHours || 0) <= 0) {
      return setError("Hãy nhập Giờ HC lớn hơn 0 khi có Giờ TC.");
    }
    setSubmitting(true);
    try {
      const payload = toPayload(form, hcHours);
      const result = editing
        ? await api.put(`/api/production-entries/${entry.id}`, { ...payload, version: entry.version })
        : await api.post("/api/production-entries", payload);
      setServerResult(result);
      toast.success(editing ? "Đã cập nhật sản lượng." : "Đã lưu sản lượng.");
      if (intentRef.current === "continue" && !editing) {
        setForm((current) => ({ ...initialState(null, session), workDate: current.workDate, employeeId: current.employeeId, orderId: current.orderId, operationId: current.operationId }));
        setHcHours("");
        setAttendanceLookupVersion((current) => current + 1);
        attendanceHoursEditedRef.current = false;
        setServerResult(null);
      } else if (onSaved) onSaved(result);
      else if (!editing) navigate("/production");
    } catch (requestError) {
      setConflict(isVersionConflict(requestError));
      setError(mapProductionEntryError(requestError, editing ? "Không thể cập nhật sản lượng." : "Không thể lưu sản lượng."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="erp-state">Đang tải dữ liệu nhập sản lượng...</div>;

  const content = (
    <form onSubmit={submit} className="erp-form-page">
      {!inPanel && <PageHeader title={editing ? "Sửa sản lượng" : "Nhập sản lượng"} description={editing ? "Cập nhật dữ liệu và giữ nguyên kiểm soát phiên bản." : "Nhập sản lượng theo quy trình sản xuất."} />}
      {error && <Alert variant={conflict ? "warning" : "error"} title={conflict ? "Xung đột phiên bản" : "Không thể hoàn tất thao tác."} action={conflict ? <button type="button" className="erp-button erp-button-secondary" onClick={() => { setForm(initialState(entry, session)); setConflict(false); setError(""); }}>Tải lại dữ liệu</button> : undefined}>{error}</Alert>}
      <FormSection title="Thông tin chung" description={canChooseEmployee ? "Chọn đúng nhân viên, mã sản xuất và công đoạn." : "Thông tin được gắn với tài khoản đang đăng nhập."}>
        {canChooseEmployee ? <Field label="Nhân viên" required><select className="erp-control" required value={form.employeeId} onChange={(event) => update("employeeId", event.target.value)}><option value="">Chọn nhân viên</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></Field> : <Field label="Nhân viên"><div className="erp-readonly-field">{session.fullName || session.username}</div></Field>}
        <Field label="Ngày" required><input className="erp-control" type="date" required value={form.workDate} onChange={(event) => update("workDate", event.target.value)} /></Field>
        <Field label="Mã sản xuất" required><select className="erp-control" required value={form.orderId} onChange={(event) => { update("orderId", event.target.value); update("operationId", ""); }}><option value="">Chọn mã sản xuất</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}</select></Field>
        <Field label="Công đoạn" required><select className="erp-control" required value={form.operationId} onChange={(event) => update("operationId", event.target.value)}><option value="">Chọn công đoạn</option>{operations.map((item) => <option key={item.id} value={item.id}>CĐ{item.operationNumber} — {item.name} ({item.unit})</option>)}</select></Field>
      </FormSection>
      <FormSection title="Sản lượng" description={hcHours !== "" && hcHours !== null ? `Giờ HC mặc định: ${hcHours} giờ; có thể chỉnh trước khi lưu.` : "Chưa có chấm công; hãy nhập giờ nếu cần tính TC."}>
        <div className="erp-field-wide"><div className="erp-field-label">Chế độ nhập</div><div className="erp-mode-grid">{MODES.map((item) => <button key={item.value} className={`erp-mode-option ${form.mode === item.value ? "is-selected" : ""}`} type="button" onClick={() => update("mode", item.value)}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div></div>
        {form.mode === "ByShift" && <><NumberField label="Sản lượng Ca 1" value={form.shift1Quantity} onChange={(value) => update("shift1Quantity", value)} /><NumberField label="Sản lượng Ca 2" value={form.shift2Quantity} onChange={(value) => update("shift2Quantity", value)} /><NumberField label="Giờ HC" value={hcHours} onChange={updateHcHours} optional step="any" /><NumberField label="Giờ TC" value={form.overtimeHours} onChange={(value) => update("overtimeHours", value)} optional step="0.25" /><NumberField label="Sản lượng TC thực tế" value={form.overtimeQuantity} onChange={(value) => update("overtimeQuantity", value)} optional /></>}
        {form.mode === "Direct" && <><NumberField label="HC thực tế" value={form.directHcQuantity} onChange={(value) => update("directHcQuantity", value)} /><NumberField label="TC thực tế" value={form.directTcQuantity} onChange={(value) => update("directTcQuantity", value)} /></>}
        {form.mode === "TotalWithOvertime" && <><NumberField label="Tổng sản lượng" value={form.totalQuantity} onChange={(value) => update("totalQuantity", value)} /><NumberField label="Giờ HC" value={hcHours} onChange={updateHcHours} optional step="any" /><NumberField label="Giờ TC" value={form.overtimeHours} onChange={(value) => update("overtimeHours", value)} optional step="0.25" /></>}
        <div className="erp-field-wide"><ProductionEntryPreview preview={preview} serverResult={serverResult} /></div>
      </FormSection>
      <FormSection title="Thời gian & ghi chú">
        <Field label="Từ giờ"><input className="erp-control" type="time" value={form.workStart} onChange={(event) => update("workStart", event.target.value)} /></Field>
        <Field label="Đến giờ"><input className="erp-control" type="time" value={form.workEnd} onChange={(event) => update("workEnd", event.target.value)} /></Field>
        <Field label="Ghi chú" wide><textarea className="erp-control erp-textarea" rows="3" value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="Ví dụ: đổi mã buổi chiều..." /></Field>
      </FormSection>
      <div className="erp-form-actions erp-mobile-action-bar"><button type="button" className="erp-button erp-button-secondary" onClick={cancel}>Hủy</button>{!editing && <button type="submit" className="erp-button erp-button-secondary" disabled={submitting} onClick={() => { intentRef.current = "continue"; }}>Lưu & nhập tiếp</button>}<button type="submit" className="erp-button erp-button-primary" disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</button></div>
    </form>
  );
  return inPanel ? content : <div className="erp-form-page-wrap">{content}</div>;
}

function NumberField({ label, value, onChange, optional = false, step = "1" }) {
  return <Field label={label} required={!optional} hint={optional ? "Không bắt buộc" : undefined}><input className="erp-control" type="number" min="0" step={step} required={!optional} value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" /></Field>;
}
