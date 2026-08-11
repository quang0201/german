import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";

const DEFAULT_PERIODS = [
  { name: "Ca 1", startTime: "07:00", endTime: "11:30", sortOrder: 1 },
  { name: "Ca 2", startTime: "12:30", endTime: "17:00", sortOrder: 2 },
];

function apiTime(value) { return value && value.length === 5 ? `${value}:00` : value; }
function localToday() { const date = new Date(); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); }

export function EmployeeSettingsPage() {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState("");
  const [employeeForm, setEmployeeForm] = useState({ employeeCode: "", fullName: "" });
  const [shiftName, setShiftName] = useState("Ca hành chính");
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [assignment, setAssignment] = useState({ employeeId: "", shiftTemplateId: "", effectiveFrom: localToday() });

  async function load() {
    try {
      const [employeeRows, shiftRows] = await Promise.all([api.get("/api/employees"), api.get("/api/shift-templates")]);
      setEmployees(employeeRows); setShifts(shiftRows);
      setAssignment((value) => ({ ...value, employeeId: value.employeeId || employeeRows[0]?.id || "", shiftTemplateId: value.shiftTemplateId || shiftRows[0]?.id || "" }));
    } catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { load(); }, []);
  const totalHours = useMemo(() => periods.reduce((sum, period) => { const [sh, sm] = period.startTime.split(":").map(Number); const [eh, em] = period.endTime.split(":").map(Number); return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60); }, 0), [periods]);

  async function createEmployee(event) {
    event.preventDefault(); setError("");
    try { await api.post("/api/employees", employeeForm); setEmployeeForm({ employeeCode: "", fullName: "" }); await load(); } catch (requestError) { setError(requestError.message); }
  }
  async function createShift(event) {
    event.preventDefault(); setError("");
    try { await api.post("/api/shift-templates", { name: shiftName, periods: periods.map((p, index) => ({ ...p, startTime: apiTime(p.startTime), endTime: apiTime(p.endTime), sortOrder: index + 1 })) }); await load(); } catch (requestError) { setError(requestError.message); }
  }
  async function assignShift(event) {
    event.preventDefault(); setError("");
    try { await api.post(`/api/employees/${assignment.employeeId}/shift-assignments`, { shiftTemplateId: assignment.shiftTemplateId, effectiveFrom: assignment.effectiveFrom }); } catch (requestError) { setError(requestError.message); }
  }
  function updatePeriod(index, key, value) { setPeriods((items) => items.map((item, i) => i === index ? { ...item, [key]: value } : item)); }
  function addPeriod() { setPeriods((items) => [...items, { name: `Ca ${items.length + 1}`, startTime: "", endTime: "", sortOrder: items.length + 1 }]); }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {error && <div className="xl:col-span-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6"><h1 className="text-xl font-bold">Nhân viên</h1><form onSubmit={createEmployee} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Mã nhân viên"><input required value={employeeForm.employeeCode} onChange={(e) => setEmployeeForm({ ...employeeForm, employeeCode: e.target.value })} className={inputClass} /></Field><Field label="Họ tên"><input required value={employeeForm.fullName} onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })} className={inputClass} /></Field><button className="sm:col-span-2 min-h-11 rounded-xl bg-slate-950 font-bold text-white">Thêm nhân viên</button></form><div className="mt-5 divide-y divide-slate-100">{employees.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div><div className="font-semibold">{item.fullName}</div><div className="text-xs text-slate-500">{item.employeeCode}</div></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.isActive ? "Hoạt động" : "Đã tắt"}</span></div>)}</div></section>
      <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Bộ ca HC</h2><p className="mt-1 text-sm text-slate-500">Hệ thống tính theo đúng khung giờ bạn tạo.</p></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{totalHours.toFixed(2)} giờ</span></div><form onSubmit={createShift} className="mt-4 space-y-3"><Field label="Tên bộ ca"><input required value={shiftName} onChange={(e) => setShiftName(e.target.value)} className={inputClass} /></Field>{periods.map((period, index) => <div key={index} className="grid grid-cols-[1fr_110px_110px] gap-2"><input required value={period.name} onChange={(e) => updatePeriod(index, "name", e.target.value)} className={inputClass} placeholder="Tên ca" /><input required type="time" value={period.startTime} onChange={(e) => updatePeriod(index, "startTime", e.target.value)} className={inputClass} /><input required type="time" value={period.endTime} onChange={(e) => updatePeriod(index, "endTime", e.target.value)} className={inputClass} /></div>)}<div className="flex gap-2"><button type="button" onClick={addPeriod} className="min-h-11 flex-1 rounded-xl border border-slate-300 text-sm font-semibold">+ Thêm khung giờ</button><button className="min-h-11 flex-1 rounded-xl bg-slate-950 text-sm font-bold text-white">Lưu bộ ca</button></div></form><div className="mt-5 space-y-2">{shifts.map((shift) => <div key={shift.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{shift.name}</span><span className="text-sm font-bold tabular-nums">{shift.totalHours}h</span></div><div className="mt-1 text-xs text-slate-500">{shift.periods.map((p) => `${p.name} ${String(p.startTime).slice(0,5)}-${String(p.endTime).slice(0,5)}`).join(" · ")}</div></div>)}</div></section>
      <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6 xl:col-span-2"><h2 className="text-xl font-bold">Gán ca theo ngày hiệu lực</h2><form onSubmit={assignShift} className="mt-4 grid gap-3 md:grid-cols-4"><Field label="Nhân viên"><select required value={assignment.employeeId} onChange={(e) => setAssignment({ ...assignment, employeeId: e.target.value })} className={inputClass}>{employees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></Field><Field label="Bộ ca"><select required value={assignment.shiftTemplateId} onChange={(e) => setAssignment({ ...assignment, shiftTemplateId: e.target.value })} className={inputClass}>{shifts.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Hiệu lực từ"><input required type="date" value={assignment.effectiveFrom} onChange={(e) => setAssignment({ ...assignment, effectiveFrom: e.target.value })} className={inputClass} /></Field><div className="flex items-end"><button disabled={!assignment.employeeId || !assignment.shiftTemplateId} className="min-h-11 w-full rounded-xl bg-sky-600 px-4 font-bold text-white disabled:opacity-50">Gán ca</button></div></form></section>
    </div>
  );
}
function Field({ label, children }) { return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>; }
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100";
