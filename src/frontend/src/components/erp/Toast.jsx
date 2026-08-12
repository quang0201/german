import React from "react";

export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className={`erp-toast erp-toast-${toast.variant}`} role="status">
      <span>{toast.message}</span>
      <button type="button" className="erp-toast-close" onClick={() => onDismiss(toast.id)} aria-label="Đóng thông báo">×</button>
    </div>
  );
}
