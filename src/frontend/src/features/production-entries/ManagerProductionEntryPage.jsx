import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { ProductionEntryForm } from "./ProductionEntryForm.jsx";

export function ManagerProductionEntryPage({ session }) {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/api/employees")
      .then((items) => {
        if (!active) return;
        const activeItems = items.filter((item) => item.isActive);
        setEmployees(activeItems);
        setEmployeeId(activeItems[0]?.id ?? "");
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, []);

  const employee = useMemo(
    () => employees.find((item) => String(item.id) === String(employeeId)),
    [employees, employeeId],
  );

  if (error) {
    return <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>;
  }

  if (employees.length === 0) {
    return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">Chưa có nhân viên đang hoạt động. Hãy tạo nhân viên trước.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="manager-entry-employee">Nhập sản lượng cho</label>
        <select id="manager-entry-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100">
          {employees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}
        </select>
      </section>

      {employee && (
        <ProductionEntryForm
          key={employee.id}
          session={{ ...session, employeeId: employee.id, fullName: employee.fullName, username: employee.employeeCode }}
        />
      )}
    </div>
  );
}
