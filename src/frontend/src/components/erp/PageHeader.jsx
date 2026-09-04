import React from "react";

export function PageHeader({ title, description, actions, eyebrow }) {
  const hasContent = Boolean(eyebrow || title || description);

  return (
    <header className="erp-page-header">
      {hasContent && <div>
        {eyebrow && <div className="erp-eyebrow">{eyebrow}</div>}
        {title && <h1 className="erp-page-title">{title}</h1>}
        {description && <p className="erp-page-description">{description}</p>}
      </div>}
      {actions && <div className="erp-page-actions">{actions}</div>}
    </header>
  );
}
