import React from "react";

export function Field({ label, required = false, hint, error, children, htmlFor, wide = false }) {
  return (
    <label className={`erp-field ${wide ? "erp-field-wide" : ""}`} htmlFor={htmlFor}>
      <span className="erp-field-label">
        {label}
        {required && <span className="erp-required" aria-hidden="true">*</span>}
      </span>
      {children}
      {hint && !error && <span className="erp-field-hint">{hint}</span>}
      {error && <span className="erp-field-error" role="alert">{error}</span>}
    </label>
  );
}
