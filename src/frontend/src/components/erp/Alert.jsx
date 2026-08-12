import React from "react";

export function Alert({ variant = "info", title, children, action }) {
  return (
    <div className={`erp-alert erp-alert-${variant}`} role="alert">
      <div className="erp-alert-copy">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
      {action && <div className="erp-alert-action">{action}</div>}
    </div>
  );
}
