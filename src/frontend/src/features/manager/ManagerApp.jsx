import React, { useState } from "react";
import { ProductionEntryTable } from "../production-entries/ProductionEntryTable.jsx";
import { ManagerProductionEntryPage } from "../production-entries/ManagerProductionEntryPage.jsx";
import { ProductionOrderPage } from "../production-orders/ProductionOrderPage.jsx";
import { EmployeeSettingsPage } from "../employees/EmployeeSettingsPage.jsx";
import { UserAccountPage } from "../admin/UserAccountPage.jsx";

const BASE_TABS = [
  ["entries", "Sản lượng"],
  ["submit", "Nhập thay"],
  ["orders", "Mã sản xuất"],
  ["employees", "Nhân viên & ca"],
];

export function ManagerApp({ session }) {
  const [tab, setTab] = useState("entries");
  const tabs = session.role === "Admin" ? [...BASE_TABS, ["accounts", "Tài khoản"]] : BASE_TABS;

  return (
    <div className="space-y-5">
      <nav className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
        <div className="flex min-w-max gap-1">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${tab === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "entries" && <ProductionEntryTable />}
      {tab === "submit" && <ManagerProductionEntryPage session={session} />}
      {tab === "orders" && <ProductionOrderPage />}
      {tab === "employees" && <EmployeeSettingsPage />}
      {tab === "accounts" && session.role === "Admin" && <UserAccountPage />}
    </div>
  );
}
