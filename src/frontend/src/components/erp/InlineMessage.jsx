import React from "react";

export function InlineMessage({ variant = "info", children }) {
  return <div className={`erp-inline-message erp-inline-${variant}`} role={variant === "error" ? "alert" : undefined}>{children}</div>;
}
