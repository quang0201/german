import React from "react";
import { ProductionEntryFormPage } from "./ProductionEntryFormPage.jsx";

export function ProductionEntryDialog({ open = false, session, entry = null, onClose, onSaved }) {
  if (!open) return null;

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-production-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="production-entry-dialog-title">
        <div className="erp-production-entry-dialog-header">
          <h2 id="production-entry-dialog-title">{entry ? "Sửa sản lượng" : "Nhập sản lượng"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose}>×</button>
        </div>
        <ProductionEntryFormPage session={session} entry={entry} inPanel onCancel={onClose} onSaved={onSaved} />
      </section>
    </div>
  );
}
