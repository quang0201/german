import React from "react";

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <header className="erp-page-header">
      <div>
        {eyebrow && <div className="erp-eyebrow">{eyebrow}</div>}
        <h1 className="erp-page-title">{title}</h1>
        {description && <p className="erp-page-description">{description}</p>}
      </div>
      {actions && <div className="erp-page-actions">{actions}</div>}
    </header>
  );
}
