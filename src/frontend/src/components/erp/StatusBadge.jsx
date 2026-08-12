import React from "react";

const allowedVariants = new Set(["neutral", "info", "success", "warning", "error"]);

export function StatusBadge({ variant = "neutral", children }) {
  const safeVariant = allowedVariants.has(variant) ? variant : "neutral";
  return <span className={`erp-status erp-status-${safeVariant}`}>{children}</span>;
}
