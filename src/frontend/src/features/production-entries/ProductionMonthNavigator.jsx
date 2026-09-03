import React from "react";
import { monthLabel } from "./productionMonthlyMatrix.js";

export function ProductionMonthNavigator({ monthKey, onPrevious, onNext }) {
  return (
    <div className="erp-production-month-nav" aria-label="Điều hướng tháng sản lượng">
      <button type="button" className="erp-button erp-button-secondary erp-production-month-nav-button" onClick={onPrevious} aria-label="Tháng trước"><span aria-hidden="true">←</span><span>Tháng trước</span></button>
      <strong>{monthLabel(monthKey)}</strong>
      <button type="button" className="erp-button erp-button-secondary erp-production-month-nav-button" onClick={onNext} aria-label="Tháng sau"><span>Tháng sau</span><span aria-hidden="true">→</span></button>
    </div>
  );
}
