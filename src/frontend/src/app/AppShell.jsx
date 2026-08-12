import React, { useEffect, useState } from "react";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";

export function AppShell({ session, pathname, breadcrumbs, onLogout, children }) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("erp-mobile-nav-open", mobileOpen);
    return () => document.body.classList.remove("erp-mobile-nav-open");
  }, [mobileOpen]);
  return (
    <div className={`erp-app ${desktopCollapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-nav-open" : ""}`}>
      <div className={`erp-sidebar-layer ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)}>
        <div onClick={(event) => event.stopPropagation()}>
          <Sidebar role={session.role} pathname={pathname} collapsed={mobileOpen ? false : desktopCollapsed} onToggle={() => setDesktopCollapsed((value) => !value)} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>
      <div className="erp-main">
        <Topbar session={session} breadcrumbs={breadcrumbs} onLogout={onLogout} onMenu={() => setMobileOpen(true)} />
        <main className="erp-content">
          <Breadcrumbs items={breadcrumbs} />
          {children}
        </main>
      </div>
    </div>
  );
}
