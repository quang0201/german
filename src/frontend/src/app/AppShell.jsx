import React, { useEffect, useState } from "react";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";

const compactDesktopQuery = "(min-width: 1024px) and (max-width: 1279px)";

function compactDesktopStartsCollapsed() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(compactDesktopQuery).matches
    : false;
}

export function AppShell({ session, pathname, breadcrumbs, onLogout, children }) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(compactDesktopStartsCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(compactDesktopQuery);
    const syncBreakpointDefault = (event) => setDesktopCollapsed(event.matches);
    media.addEventListener("change", syncBreakpointDefault);
    return () => media.removeEventListener("change", syncBreakpointDefault);
  }, []);
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
