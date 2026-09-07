import React from "react";
import { formatDisplayDate } from "./productionPeriod.js";

export function ProductionWeekNavigator({ fromDate, untilDate, onPrevious, onNext }) {
  return (
    <div className="erp-production-month-nav" aria-label="Điều hướng tuần sản lượng">
      <button type="button" className="erp-button erp-button-secondary erp-production-month-nav-button" onClick={onPrevious} aria-label="Tuần trước"><span aria-hidden="true">←</span><span>Tuần trước</span></button>
      <strong>{formatDisplayDate(fromDate)} – {formatDisplayDate(untilDate)}</strong>
      <button type="button" className="erp-button erp-button-secondary erp-production-month-nav-button" onClick={onNext} aria-label="Tuần sau"><span>Tuần sau</span><span aria-hidden="true">→</span></button>
    </div>
  );
}
