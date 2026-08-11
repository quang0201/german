import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";

export function UserAccountPage() {
  const [accounts, setAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", role: "Worker", employeeId: "" });
  const [error, setError] = useState("");

  async function load() {
    try {
      const [accountRows, employeeRows] = await Promise.all([api.get("/api/admin/user-accounts"), api.get("/api/employees")]);
      setAccounts(accountRows); setEmployees(employeeRows);
    } catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { load(); }, []);
  const assignedIds = useMemo(() => new Set(accounts.filter((x) => x.employeeId).map((x) => String(x.employeeId))), [accounts]);
  const availableEmployees = employees.filter((item) => item.isActive && !assignedIds.has(String(item.id)));

  async function create(event) {
    event.preventDefault(); setError("");
    try {
      await api.post("/api/admin/user-accounts", { username: form.username.trim(), password: form.password, role: form.role, employeeId: form.employeeId || null });
      setForm({ username: "", password: "", role: "Worker", employeeId: "" });
      await load();
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]"><section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200"><h1 className="text-xl font-bold">Tạo tài khoản</h1><form onSubmit={create} className="mt-5 space-y-4"><Field label="Tên đăng nhập"><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputClass} /></Field><Field label="Mật khẩu"><input required minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} /></Field><Field label="Vai trò"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}><option value="Worker">Công nhân</option><option value="Manager">Quản lý</option><option value="Admin">Admin</option></select></Field><Field label="Gắn nhân viên"><select required={form.role === "Worker"} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={inputClass}><option value="">Không gắn</option>{availableEmployees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></Field>{error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<button className="min-h-12 w-full rounded-xl bg-slate-950 font-bold text-white">Tạo tài khoản</button></form></section><section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6"><h2 className="text-xl font-bold">Tài khoản hiện có</h2><div className="mt-4 divide-y divide-slate-100">{accounts.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-semibold">{account.username}</div><div className="mt-1 text-xs text-slate-500">{account.employeeCode ? `${account.employeeCode} — ${account.employeeName}` : "Không gắn nhân viên"}</div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{account.role}</span></div>)}</div></section></div>
  );
}
function Field({ label, children }) { return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>; }
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100";
