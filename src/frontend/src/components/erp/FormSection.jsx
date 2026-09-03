import React from "react";

export function FormSection({ title, description, children, actions }) {
  return (
    <section className="erp-form-section">
      <div className="erp-section-heading">
        <div>
          <h2 className="erp-section-title">{title}</h2>
          {description && <p className="erp-section-description">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="erp-form-grid">{children}</div>
    </section>
  );
}
