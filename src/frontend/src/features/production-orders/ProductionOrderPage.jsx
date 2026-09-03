import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";

const STATUSES = ["Draft", "InProduction", "Completed", "Cancelled"];

export function ProductionOrderPage() {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: "", productName: "", plannedQuantity: "", status: "Draft", cloneFromOrderId: "" });
  const [operation, setOperation] = useState({ operationNumber: "", name: "", unit: "cái", sortOrder: "" });

  async function load() {
    try {
      const items = await api.get("/api/production-orders");
      setOrders(items);
      setSelectedId((current) => current && items.some((item) => String(item.id) === String(current)) ? current : (items[0]?.id ?? ""));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { load(); }, []);
  const selected = useMemo(() => orders.find((item) => String(item.id) === String(selectedId)), [orders, selectedId]);

  async function createOrder(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const created = await api.post("/api/production-orders", {
        code: form.code.trim(), productName: form.productName.trim(), plannedQuantity: Number(form.plannedQuantity), status: form.status,
        cloneFromOrderId: form.cloneFromOrderId || null,
        operations: null,
      });
      setForm({ code: "", productName: "", plannedQuantity: "", status: "Draft", cloneFromOrderId: "" });
      await load();
      setSelectedId(created.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(status) {
    if (!selected) return;
    try {
      await api.put(`/api/production-orders/${selected.id}`, {
        code: selected.code, productName: selected.productName, plannedQuantity: selected.plannedQuantity, status,
        startDate: selected.startDate ?? null, endDate: selected.endDate ?? null,
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function addOperation(event) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    try {
      await api.post(`/api/production-orders/${selected.id}/operations`, {
        operationNumber: Number(operation.operationNumber), name: operation.name.trim(), unit: operation.unit.trim(), sortOrder: Number(operation.sortOrder || operation.operationNumber), isActive: true,
      });
      setOperation({ operationNumber: "", name: "", unit: "cái", sortOrder: "" });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
        <h1 className="text-xl font-bold">Tạo mã sản xuất</h1>
        <form onSubmit={createOrder} className="mt-5 space-y-4">
          <Field label="Mã sản xuất"><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} /></Field>
          <Field label="Tên sản phẩm"><input required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} className={inputClass} /></Field>
          <Field label="Số lượng kế hoạch"><input required min="0" type="number" step="0.01" value={form.plannedQuantity} onChange={(e) => setForm({ ...form, plannedQuantity: e.target.value })} className={inputClass} /></Field>
          <Field label="Trạng thái"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Sao chép công đoạn từ"><select value={form.cloneFromOrderId} onChange={(e) => setForm({ ...form, cloneFromOrderId: e.target.value })} className={inputClass}><option value="">Tạo mới hoàn toàn</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}</select></Field>
          <button disabled={creating} className="min-h-12 w-full rounded-xl bg-slate-950 font-bold text-white disabled:opacity-50">{creating ? "Đang tạo..." : "Tạo mã sản xuất"}</button>
        </form>
      </section>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Danh sách & công đoạn</h2><p className="mt-1 text-sm text-slate-500">Mỗi mã có bộ công đoạn độc lập.</p></div><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3">{orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}</select></div>
        {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {!selected && <div className="mt-6 text-sm text-slate-500">Chưa có mã sản xuất.</div>}
        {selected && <><div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-bold text-slate-950">{selected.code} — {selected.productName}</div><div className="mt-1 text-sm text-slate-500">Kế hoạch: {selected.plannedQuantity}</div></div><select value={selected.status} onChange={(e) => updateStatus(e.target.value)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></div></div><div className="mt-5 space-y-2">{selected.operations.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><div className="font-semibold">CĐ{item.operationNumber} — {item.name}</div><div className="mt-1 text-xs text-slate-500">Đơn vị: {item.unit} · Thứ tự: {item.sortOrder}</div></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.isActive ? "Đang dùng" : "Tắt"}</span></div>)}</div><form onSubmit={addOperation} className="mt-5 grid gap-3 rounded-2xl border border-dashed border-slate-300 p-4 sm:grid-cols-4"><Field label="Số CĐ"><input required min="1" type="number" value={operation.operationNumber} onChange={(e) => setOperation({ ...operation, operationNumber: e.target.value })} className={inputClass} /></Field><Field label="Tên công đoạn"><input required value={operation.name} onChange={(e) => setOperation({ ...operation, name: e.target.value })} className={inputClass} /></Field><Field label="Đơn vị"><input required value={operation.unit} onChange={(e) => setOperation({ ...operation, unit: e.target.value })} className={inputClass} /></Field><div className="flex items-end"><button className="min-h-11 w-full rounded-xl bg-sky-600 px-3 text-sm font-bold text-white">Thêm công đoạn</button></div></form></>}
      </section>
    </div>
  );
}

function Field({ label, children }) { return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>; }
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100";
