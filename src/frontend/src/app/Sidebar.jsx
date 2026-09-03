import React from "react";
import { Icon } from "../components/erp/Icon.jsx";
import { navigate } from "./navigation.js";
import { routes } from "./routes.js";

function navItems(role) {
  const preferredOrder = ["/reports", "/reports/monthly", "/employees", "/orders", "/attendance", "/production", "/shifts", "/admin/accounts", "/admin/audit"];
  const seen = new Set();
  return routes.filter((route) => {
    if (!route.roles.includes(role) || route.path.includes(":id") || route.path.endsWith("/new")) return false;
    if (seen.has(route.path)) return false;
    seen.add(route.path);
    return true;
  }).sort((left, right) => preferredOrder.indexOf(left.path) - preferredOrder.indexOf(right.path));
}

const icons = {
  "/production": "production",
  "/employees": "employees",
  "/orders": "orders",
  "/shifts": "shifts",
  "/reports": "reports",
  "/reports/monthly": "reports",
  "/admin/accounts": "accounts",
  "/admin/audit": "audit",
};

export function Sidebar({ role, pathname, collapsed, onToggle, onNavigate }) {
  const items = navItems(role);
  return (
    <aside className={`erp-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="erp-sidebar-brand">
        <div className="erp-brand-mark">G</div>
        <div className="erp-sidebar-brand-copy"><strong>German</strong><span>Hệ thống sản xuất</span></div>
      </div>
      <nav className="erp-sidebar-nav" aria-label="Điều hướng chính">
        {items.map((route) => {
          const active = pathname === route.path
            || (route.path === "/reports" && pathname !== "/reports/monthly" && pathname.startsWith("/reports/"))
            || (route.path === "/production" && pathname.startsWith("/production/"));
          const label = typeof route.navLabel === "function" ? route.navLabel(role) : route.navLabel;
          return (
            <button key={route.path} type="button" className={`erp-nav-item ${active ? "is-active" : ""}`} onClick={() => { navigate(route.path); onNavigate?.(); }} title={collapsed ? label : undefined} aria-label={label}>
              <span className="erp-nav-icon"><Icon name={icons[route.path] || "production"} size={20} /></span>
              <span className="erp-nav-label">{label}</span>
            </button>
          );
        })}
      </nav>
      <button type="button" className="erp-sidebar-toggle" onClick={onToggle} aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}>
        <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} />
        <span>{collapsed ? "Mở rộng" : "Thu gọn"}</span>
      </button>
    </aside>
  );
}
