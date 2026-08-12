import React from "react";
import { displayName } from "./session.js";

export function Topbar({ session, onLogout, onMenu }) {
  return (
    <header className="erp-topbar">
      <button type="button" className="erp-mobile-menu" onClick={onMenu} aria-label="Mở menu">☰</button>
      <div className="erp-topbar-search">
        <span aria-hidden="true">⌕</span>
        <input aria-label="Tìm kiếm" placeholder="Tìm kiếm trong hệ thống" />
      </div>
      <div className="erp-user-menu">
        <div className="erp-user-avatar">{displayName(session).slice(0, 1).toUpperCase()}</div>
        <div className="erp-user-copy"><strong>{displayName(session)}</strong><span>{session.role}</span></div>
        <button type="button" className="erp-button erp-button-secondary" onClick={onLogout}>Đăng xuất</button>
      </div>
    </header>
  );
}
