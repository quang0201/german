import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { calculatePreview } from "./productionCalculation.js";
import { ProductionEntryPreview } from "./ProductionEntryPreview.jsx";

const MODES = [
  { value: "ByShift", label: "Theo ca", description: "Ca 1 + Ca 2, TC tự tính nếu chỉ nhập giờ." },
  { value: "Direct", label: "HC / TC trực tiếp", description: "Dùng khi bạn đã tự phân bổ sản lượng." },
  { value: "TotalWithOvertime", label: "Tổng + giờ TC", description: "Nhập tổng sản lượng, hệ thống tự tách HC/TC." },
];

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

export function ProductionEntryForm({ session }) {
  const [workDate, setWorkDate] = useState(localToday());
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [operations, setOperations] = useState([]);
  const [operationId, setOperationId] = useState("");
  const [hcHours, setHcHours] = useState(null);
  const [mode, setMode] = useState("ByShift");
  const [shift1Quantity, setShift1Quantity] = useState("");
  const [shift2Quantity, setShift2Quantity] = useState("");
  const [directHcQuantity, setDirectHcQuantity] = useState("");
  const [directTcQuantity, setDirectTcQuantity] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [overtimeQuantity, setOvertimeQuantity] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [serverResult, setServerResult] = useState(null);

  useEffect(() => {
    let active = true;
    api.get("/api/lookups/production-orders/active")
      .then((items) => {
        if (!active) return;
        setOrders(items);
        if (items.length > 0) setOrderId(String(items[0].id));
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!orderId) {
      setOperations([]);
      setOperationId("");
      return;
    }
    let active = true;
    api.get(`/api/production-orders/${orderId}/operations`)
      .then((items) => {
        if (!active) return;
        setOperations(items);
        setOperationId(items.length > 0 ? String(items[0].id) : "");
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [orderId]);

  useEffect(() => {
    if (!session.employeeId || !workDate) {
      setHcHours(null);
      return;
    }
    let active = true;
    api.get(`/api/lookups/hc-hours?employeeId=${encodeURIComponent(session.employeeId)}&date=${encodeURIComponent(workDate)}`)
      .then((result) => active && setHcHours(result.hcHours))
      .catch(() => active && setHcHours(null));
    return () => { active = false; };
  }, [session.employeeId, workDate]);

  const preview = useMemo(() => {
    try {
      return calculatePreview({
        mode,
        hcHours,
        shift1Quantity,
        shift2Quantity,
        directHcQuantity,
        directTcQuantity,
        totalQuantity,
        overtimeHours,
        overtimeQuantity,
      });
    } catch {
      return null;
    }
  }, [mode, hcHours, shift1Quantity, shift2Quantity, directHcQuantity, directTcQuantity, totalQuantity, overtimeHours, overtimeQuantity]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setServerResult(null);

    if (!session.employeeId) {
      setError("Tài khoản này chưa gắn với hồ sơ nhân viên.");
      return;
    }
    if (!orderId || !operationId) {
      setError("Hãy chọn mã sản xuất và công đoạn.");
      return;
    }

    const payload = {
      workDate,
      employeeId: session.employeeId,
      productionOrderId: orderId,
      productionOperationId: operationId,
      entryMode: mode,
      shift1Quantity: mode === "ByShift" ? numberOrNull(shift1Quantity) : null,
      shift2Quantity: mode === "ByShift" ? numberOrNull(shift2Quantity) : null,
      directHcQuantity: mode === "Direct" ? numberOrNull(directHcQuantity) : null,
      directTcQuantity: mode === "Direct" ? numberOrNull(directTcQuantity) : null,
      totalInputQuantity: mode === "TotalWithOvertime" ? numberOrNull(totalQuantity) : null,
      overtimeHours: mode !== "Direct" ? numberOrNull(overtimeHours) : null,
      overtimeQuantity: mode === "ByShift" ? numberOrNull(overtimeQuantity) : null,
      workStart: workStart || null,
      workEnd: workEnd || null,
      note: note.trim() || null,
    };

    setSubmitting(true);
    try {
      const result = await api.post("/api/production-entries", payload);
      setServerResult(result);
      setShift1Quantity("");
      setShift2Quantity("");
      setDirectHcQuantity("");
      setDirectTcQuantity("");
      setTotalQuantity("");
      setOvertimeHours("");
      setOvertimeQuantity("");
      setNote("");
    } catch (requestError) {
      setError(requestError.message ?? "Không thể nộp sản lượng.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">Đang tải mã sản xuất...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Nộp sản lượng</h1>
            <p className="mt-1 text-sm text-slate-500">{session.fullName || session.username}</p>
          </div>
          {hcHours !== null && (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">HC chuẩn: {hcHours} giờ</span>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Ngày">
            <input type="date" required value={workDate} onChange={(e) => { setWorkDate(e.target.value); setServerResult(null); }} className={inputClass} />
          </Field>
          <Field label="Mã sản xuất">
            <select required value={orderId} onChange={(e) => { setOrderId(e.target.value); setServerResult(null); }} className={inputClass}>
              {orders.length === 0 && <option value="">Không có mã đang chạy</option>}
              {orders.map((order) => <option key={order.id} value={order.id}>{order.code} — {order.productName}</option>)}
            </select>
          </Field>
          <Field label="Công đoạn" wide>
            <select required value={operationId} onChange={(e) => { setOperationId(e.target.value); setServerResult(null); }} className={inputClass}>
              {operations.length === 0 && <option value="">Chưa có công đoạn</option>}
              {operations.map((operation) => (
                <option key={operation.id} value={operation.id}>CĐ{operation.operationNumber} — {operation.name} ({operation.unit})</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Cách nhập</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => { setMode(item.value); setServerResult(null); }}
              className={`rounded-2xl border p-4 text-left transition ${mode === item.value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className={`mt-1 block text-xs leading-5 ${mode === item.value ? "text-slate-300" : "text-slate-500"}`}>{item.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {mode === "ByShift" && (
            <>
              <NumberField label="Sản lượng Ca 1" value={shift1Quantity} onChange={setShift1Quantity} />
              <NumberField label="Sản lượng Ca 2" value={shift2Quantity} onChange={setShift2Quantity} />
              <NumberField label="Giờ tăng ca" value={overtimeHours} onChange={setOvertimeHours} step="0.25" optional />
              <NumberField label="Sản lượng TC thực tế" value={overtimeQuantity} onChange={setOvertimeQuantity} optional hint="Nếu nhập, hệ thống ưu tiên số thực tế này." />
            </>
          )}
          {mode === "Direct" && (
            <>
              <NumberField label="HC thực tế" value={directHcQuantity} onChange={setDirectHcQuantity} />
              <NumberField label="TC thực tế" value={directTcQuantity} onChange={setDirectTcQuantity} />
            </>
          )}
          {mode === "TotalWithOvertime" && (
            <>
              <NumberField label="Tổng sản lượng" value={totalQuantity} onChange={setTotalQuantity} />
              <NumberField label="Giờ tăng ca" value={overtimeHours} onChange={setOvertimeHours} step="0.25" optional />
            </>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Thời gian & ghi chú</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Từ giờ" optional><input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className={inputClass} /></Field>
          <Field label="Đến giờ" optional><input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className={inputClass} /></Field>
          <Field label="Ghi chú" optional wide>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows="3" className={`${inputClass} py-3`} placeholder="Ví dụ: đổi mã buổi chiều..." />
          </Field>
        </div>
      </section>

      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>}
      <ProductionEntryPreview preview={preview} serverResult={serverResult} />

      <button type="submit" disabled={submitting || !orderId || !operationId} className="min-h-14 w-full rounded-2xl bg-sky-600 px-5 text-base font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
        {submitting ? "Đang nộp..." : "Nộp sản lượng"}
      </button>
    </form>
  );
}

const inputClass = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

function Field({ label, optional = false, wide = false, children }) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {label}
        {optional && <span className="text-xs font-normal text-slate-400">không bắt buộc</span>}
      </span>
      {children}
    </label>
  );
}

function NumberField({ label, value, onChange, optional = false, step = "1", hint }) {
  return (
    <Field label={label} optional={optional}>
      <input type="number" min="0" step={step} required={!optional} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} inputMode="decimal" />
      {hint && <span className="mt-1 block text-xs leading-5 text-slate-400">{hint}</span>}
    </Field>
  );
}
