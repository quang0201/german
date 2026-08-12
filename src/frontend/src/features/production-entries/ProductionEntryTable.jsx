import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { ConfirmDialog } from "../../components/erp/ConfirmDialog.jsx";
import { buildDirectUpdatePayload, buildProductionEntryQuery } from "./productionEntryManagement.js";

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function ProductionEntryTable() {
  const [date, setDate] = useState(localToday());
  const [employeeId, setEmployeeId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/api/employees"), api.get("/api/production-orders")])
      .then(([employeeRows, orderRows]) => {
        setEmployees(employeeRows);
        setOrders(orderRows);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get(buildProductionEntryQuery({ date, employeeId, orderId }));
      setRows(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [date, employeeId, orderId]);

  useEffect(() => { loadRows(); }, [loadRows]);

  async function remove(row) {
    setDeleting(row);
  }

  async function confirmRemove() {
    if (!deleting) return;
    const row = deleting;
    setDeletingLoading(true);
    setError("");
    try {
      await api.delete(`/api/production-entries/${row.id}?version=${row.version}`);
      setDeleting(null);
      await loadRows();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingLoading(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-950">Sản lượng</h1>
          <p className="mt-1 text-sm text-slate-500">Xem, sửa HC/TC hoặc xóa mềm bản ghi.</p>
        </div>
        <button type="button" onClick={loadRows} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tải lại</button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Filter label="Ngày"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Filter>
        <Filter label="Nhân viên">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
            <option value="">Tất cả</option>
            {employees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}
          </select>
        </Filter>
        <Filter label="Mã sản xuất">
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputClass}>
            <option value="">Tất cả</option>
            {orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}
          </select>
        </Filter>
      </div>

      {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>}

      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-2 py-3">Nhân viên</th><th className="px-2 py-3">Mã / CĐ</th><th className="px-2 py-3 text-right">HC</th><th className="px-2 py-3 text-right">TC</th><th className="px-2 py-3 text-right">Tổng</th><th className="px-2 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-3"><div className="font-semibold text-slate-900">{row.employeeName}</div><div className="text-xs text-slate-500">{row.employeeCode}</div></td>
                <td className="px-2 py-3"><div className="font-semibold">{row.productionOrderCode} · CĐ{row.operationNumber}</div><div className="max-w-xs truncate text-xs text-slate-500">{row.operationName}</div></td>
                <td className="px-2 py-3 text-right tabular-nums">{row.hcQuantity}</td>
                <td className="px-2 py-3 text-right tabular-nums">{row.tcQuantity}</td>
                <td className="px-2 py-3 text-right font-bold tabular-nums">{row.totalQuantity}</td>
                <td className="px-2 py-3 text-right"><RowActions row={row} onEdit={setEditing} onDelete={remove} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="font-bold">{row.employeeName}</div><div className="mt-1 text-sm text-slate-500">{row.productionOrderCode} · CĐ{row.operationNumber} · {row.operationName}</div></div><RowActions row={row} onEdit={setEditing} onDelete={remove} /></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label="HC" value={row.hcQuantity} /><Metric label="TC" value={row.tcQuantity} /><Metric label="Tổng" value={row.totalQuantity} /></div>
          </article>
        ))}
      </div>

      {!loading && rows.length === 0 && <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Không có sản lượng phù hợp bộ lọc.</div>}
      {loading && <div className="mt-6 text-center text-sm text-slate-400">Đang tải...</div>}

      {editing && <EditEntryPanel row={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await loadRows(); }} />}
      <ConfirmDialog open={Boolean(deleting)} title="Xóa sản lượng?" confirmLabel="Xóa sản lượng" loading={deletingLoading} onClose={() => setDeleting(null)} onConfirm={confirmRemove}>Xóa mềm bản ghi {deleting?.employeeName} — {deleting?.productionOrderCode} — CĐ{deleting?.operationNumber}?</ConfirmDialog>
    </section>
  );
}

function EditEntryPanel({ row, onClose, onSaved }) {
  const [hc, setHc] = useState(String(row.hcQuantity));
  const [tc, setTc] = useState(String(row.tcQuantity));
  const [note, setNote] = useState(row.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/production-entries/${row.id}`, buildDirectUpdatePayload(row, hc, tc, note));
      await onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid items-end bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <form onSubmit={save} className="mx-auto w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Chỉnh sản lượng</h2><p className="mt-1 text-sm text-slate-500">{row.employeeName} · {row.productionOrderCode} · CĐ{row.operationNumber}</p></div><button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100">Đóng</button></div>
        <div className="mt-5 grid grid-cols-2 gap-4"><Filter label="HC"><input type="number" min="0" step="0.01" required value={hc} onChange={(e) => setHc(e.target.value)} className={inputClass} /></Filter><Filter label="TC"><input type="number" min="0" step="0.01" required value={tc} onChange={(e) => setTc(e.target.value)} className={inputClass} /></Filter></div>
        <Filter label="Ghi chú"><textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-2 py-3`} /></Filter>
        {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        <button type="submit" disabled={saving} className="mt-5 min-h-12 w-full rounded-xl bg-slate-950 font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu HC / TC"}</button>
      </form>
    </div>
  );
}

function RowActions({ row, onEdit, onDelete }) {
  return <div className="flex justify-end gap-1"><button type="button" onClick={() => onEdit(row)} className="rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50">Sửa</button><button type="button" onClick={() => onDelete(row)} className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">Xóa</button></div>;
}
function Filter({ label, children }) { return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>; }
function Metric({ label, value }) { return <div className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-bold tabular-nums">{value}</div></div>; }
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100";
