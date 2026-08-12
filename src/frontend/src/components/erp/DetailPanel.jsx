import React, { useEffect, useRef } from "react";

export function DetailPanel({ open, title, onClose, children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside className="erp-detail-panel" aria-label={title}>
      <div className="erp-detail-panel-header">
        <h2>{title}</h2>
        <button ref={closeRef} className="erp-icon-button" type="button" onClick={onClose} aria-label="Đóng chi tiết">×</button>
      </div>
      <div className="erp-detail-panel-body">{children}</div>
    </aside>
  );
}
