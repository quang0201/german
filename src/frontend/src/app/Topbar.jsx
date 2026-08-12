import React from "react";
import { displayName } from "./session.js";
import { roleLabel } from "../lib/i18n.js";

export function Topbar({ session, breadcrumbs = [], onLogout, onMenu }) {
  const context = breadcrumbs.at(-1)?.label || "Hệ thống sản xuất";
  return (
    <header className="erp-topbar">
      <button type="button" className="erp-mobile-menu" onClick={onMenu} aria-label="Mở menu">☰</button>
      <div className="erp-topbar-context">{context}</div>
      <div className="erp-topbar-search">
        <span aria-hidden="true">⌕</span>
        <input aria-label="Tìm kiếm" placeholder="Tìm kiếm trong hệ thống" />
      </div>
      <div className="erp-user-menu">
        <div className="erp-user-avatar">{displayName(session).slice(0, 1).toUpperCase()}</div>
        <div className="erp-user-copy"><strong>{displayName(session)}</strong><span>{roleLabel(session.role)}</span></div>
        <button type="button" className="erp-button erp-button-secondary erp-topbar-logout" onClick={onLogout}><span className="erp-topbar-logout-full">Đăng xuất</span><span className="erp-topbar-logout-compact">Thoát</span></button>
      </div>
    </header>
  );
}
