import React from "react";
import { Icon } from "../components/erp/Icon.jsx";
import { navigate } from "./navigation.js";
import { routes } from "./routes.js";

const navigationGroups = [
  { label: "Báo cáo", paths: ["/reports", "/reports/monthly"] },
  { label: "Danh mục", paths: ["/employees", "/orders", "/settings/external-sources", "/shifts"] },
  { label: "Vận hành", paths: ["/attendance", "/production"] },
  { label: "Quản trị", paths: ["/admin/accounts", "/admin/audit"] },
];

function navGroups(role) {
  return navigationGroups.map((group) => ({
    ...group,
    routes: group.paths
      .map((path) => routes.find((route) => route.path === path))
      .filter((route) => route?.roles.includes(role)),
  })).filter((group) => group.routes.length > 0);
}

const icons = {
  "/production": "production",
  "/employees": "employees",
  "/orders": "orders",
  "/settings/external-sources": "orders",
  "/shifts": "shifts",
  "/reports": "reports",
  "/reports/monthly": "reports",
  "/admin/accounts": "accounts",
  "/admin/audit": "audit",
};

export function Sidebar({ role, pathname, collapsed, onToggle, onNavigate }) {
  const groups = navGroups(role);
  return (
    <aside className={`erp-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="erp-sidebar-brand">
        <div className="erp-brand-mark">G</div>
        <div className="erp-sidebar-brand-copy"><strong>German</strong><span>Hệ thống sản xuất</span></div>
      </div>
      <nav className="erp-sidebar-nav" aria-label="Điều hướng chính">
        {groups.map((group) => <div className="erp-nav-group" key={group.label} role="group" aria-label={group.label}>
          {!collapsed && <div className="erp-nav-group-label" aria-hidden="true">{group.label}</div>}
          {group.routes.map((route) => {
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
        </div>)}
      </nav>
      <button type="button" className="erp-sidebar-toggle" onClick={onToggle} aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}>
        <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} />
        <span>{collapsed ? "Mở rộng" : "Thu gọn"}</span>
      </button>
    </aside>
  );
}
