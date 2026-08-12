import React, { useState } from "react";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";

export function AppShell({ session, pathname, breadcrumbs, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className={`erp-app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className={`erp-sidebar-layer ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)}>
        <div onClick={(event) => event.stopPropagation()}>
          <Sidebar role={session.role} pathname={pathname} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        </div>
      </div>
      <div className="erp-main">
        <Topbar session={session} onLogout={onLogout} onMenu={() => setMobileOpen(true)} />
        <main className="erp-content">
          <Breadcrumbs items={breadcrumbs} />
          {children}
        </main>
      </div>
    </div>
  );
}
