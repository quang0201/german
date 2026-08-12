import React, { useEffect, useRef } from "react";

export function ConfirmDialog({ open, title, children, confirmLabel = "Xác nhận", cancelLabel = "Hủy", loading = false, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
      return undefined;
    }
    triggerRef.current = document.activeElement;
    dialogRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog" ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="erp-dialog-title">
        <h2 id="erp-dialog-title">{title}</h2>
        <div className="erp-dialog-body">{children}</div>
        <div className="erp-dialog-actions">
          <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>{cancelLabel}</button>
          <button type="button" className="erp-button erp-button-danger" onClick={onConfirm} disabled={loading}>{loading ? "Đang xử lý..." : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
