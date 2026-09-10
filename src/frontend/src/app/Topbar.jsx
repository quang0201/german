import React from "react";
import { Icon } from "../components/erp/Icon.jsx";
import { api } from "../lib/api.js";
import { roleLabel } from "../lib/i18n.js";
import { displayName } from "./session.js";
import { useState } from "react";

export function Topbar({ session, breadcrumbs = [], onLogout, onMenu }) {
  const context = breadcrumbs.at(-1)?.label || "Hệ thống sản xuất";
  const [copyingMcpSession, setCopyingMcpSession] = useState(false);
  const [mcpSessionMessage, setMcpSessionMessage] = useState("");
  const canCopyMcpSession = session?.role === "Manager" || session?.role === "Admin";

  async function copyMcpSession() {
    setCopyingMcpSession(true);
    setMcpSessionMessage("");
    try {
      const result = await api.post("/api/auth/mcp-token", {});
      if (!result?.token || !navigator.clipboard?.writeText) {
        throw new Error("Trình duyệt không hỗ trợ copy tự động.");
      }
      await navigator.clipboard.writeText(result.token);
      setMcpSessionMessage("Đã copy token MCP");
    } catch (error) {
      setMcpSessionMessage(error.message || "Không thể tạo mã MCP.");
    } finally {
      setCopyingMcpSession(false);
    }
  }

  return (
    <header className="erp-topbar">
      <button type="button" className="erp-mobile-menu" onClick={onMenu} aria-label="Mở menu"><Icon name="menu" size={22} /></button>
      <div className="erp-topbar-context">{context}</div>
      <div className="erp-topbar-search">
        <Icon name="search" size={18} />
        <input aria-label="Tìm kiếm" placeholder="Tìm kiếm trong hệ thống" />
      </div>
      <div className="erp-user-menu">
        <div className="erp-user-avatar">{displayName(session).slice(0, 1).toUpperCase()}</div>
        <div className="erp-user-copy"><strong>{displayName(session)}</strong><span>{roleLabel(session.role)}</span></div>
        {canCopyMcpSession && <button type="button" className="erp-button erp-button-secondary erp-topbar-mcp" onClick={copyMcpSession} disabled={copyingMcpSession} title="Tạo token để kết nối MCP; token mới sẽ thu hồi token cũ">{copyingMcpSession ? "Đang tạo..." : "Tạo token MCP"}</button>}
        {mcpSessionMessage && <span className="erp-topbar-mcp-message" role="status">{mcpSessionMessage}</span>}
        <button type="button" className="erp-button erp-button-secondary erp-topbar-logout" onClick={onLogout}>
          <Icon name="logout" size={17} />
          <span className="erp-topbar-logout-full">Đăng xuất</span>
          <span className="erp-topbar-logout-compact">Thoát</span>
        </button>
      </div>
    </header>
  );
}
