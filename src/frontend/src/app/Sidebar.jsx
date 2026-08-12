import React from "react";
import { navigate } from "./navigation.js";
import { routes } from "./routes.js";

function navItems(role) {
  const seen = new Set();
  return routes.filter((route) => {
    if (!route.roles.includes(role) || route.path.includes(":id") || route.path.endsWith("/new")) return false;
    if (seen.has(route.path)) return false;
    seen.add(route.path);
    return true;
  });
}

export function Sidebar({ role, pathname, collapsed, onToggle }) {
  const items = navItems(role);
  return (
    <aside className={`erp-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="erp-sidebar-brand">
        <div className="erp-brand-mark">G</div>
        {!collapsed && <div><strong>German</strong><span>Production ERP</span></div>}
      </div>
      <nav className="erp-sidebar-nav" aria-label="Điều hướng chính">
        {items.map((route) => {
          const active = pathname === route.path || (route.path === "/production" && pathname.startsWith("/production/"));
          const label = typeof route.navLabel === "function" ? route.navLabel(role) : route.navLabel;
          return (
            <button key={route.path} type="button" className={`erp-nav-item ${active ? "is-active" : ""}`} onClick={() => navigate(route.path)} title={collapsed ? label : undefined}>
              <span className="erp-nav-icon" aria-hidden="true">{label.slice(0, 1)}</span>
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>
      <button type="button" className="erp-sidebar-toggle" onClick={onToggle}>{collapsed ? "→" : "← Thu gọn"}</button>
    </aside>
  );
}
