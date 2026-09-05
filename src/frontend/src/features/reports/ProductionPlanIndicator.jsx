import React from "react";
import { productionPlanLimit } from "./productionPlanStatus.js";

function quantity(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export function ProductionPlanIndicator({ plannedQuantity }) {
  const planned = Number(plannedQuantity);
  const planLimit = productionPlanLimit(plannedQuantity);

  if (planLimit === null) return null;

  return (
    <div
      className="erp-report-plan-indicator"
      role="note"
      aria-label={`Kế hoạch ${quantity(planned)}, cho phép chênh lệch 100, cảnh báo từ ${quantity(planLimit + 1)}`}
    >
      <span className="erp-report-plan-indicator-icon" aria-hidden="true">!</span>
      <span className="erp-report-plan-indicator-copy">
        <strong>Kế hoạch {quantity(planned)}</strong>
        <small>Cho phép chênh ±100 · cảnh báo từ {quantity(planLimit + 1)}</small>
      </span>
    </div>
  );
}
