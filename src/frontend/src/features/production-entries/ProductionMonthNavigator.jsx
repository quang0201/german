import React from "react";
import { monthLabel } from "./productionMonthlyMatrix.js";

export function ProductionMonthNavigator({ monthKey, onPrevious, onNext }) {
  return (
    <div className="erp-production-month-nav" aria-label="Điều hướng tháng sản lượng">
      <button type="button" className="erp-button erp-button-secondary" onClick={onPrevious} aria-label="Tháng trước">←</button>
      <strong>{monthLabel(monthKey)}</strong>
      <button type="button" className="erp-button erp-button-secondary" onClick={onNext} aria-label="Tháng sau">→</button>
    </div>
  );
}
