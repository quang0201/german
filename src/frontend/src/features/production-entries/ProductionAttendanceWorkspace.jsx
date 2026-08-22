import React, { useState } from "react";
import { AttendancePage } from "../attendance/AttendancePage.jsx";
import { ProductionEntryManagerMatrixPage } from "./ProductionEntryManagerMatrixPage.jsx";
import "./ProductionAttendanceWorkspace.css";

export function ProductionAttendanceWorkspace(props) {
  const [activeView, setActiveView] = useState("production");
  const [visitedViews, setVisitedViews] = useState({
    production: true,
    attendance: false,
  });

  function selectView(view) {
    setActiveView(view);
    setVisitedViews((current) => ({ ...current, [view]: true }));
  }

  return (
    <div className="erp-production-attendance-workspace">
      <section className="erp-production-attendance-switcher" aria-label="Chọn màn nhập liệu">
        <div className="erp-production-attendance-tabs" role="tablist" aria-label="Loại dữ liệu nhập">
          <button type="button" role="tab" aria-selected={activeView === "production"} className={`erp-button ${activeView === "production" ? "erp-button-primary" : "erp-button-secondary"}`} onClick={() => selectView("production")}>Nhập sản lượng</button>
          <button type="button" role="tab" aria-selected={activeView === "attendance"} className={`erp-button ${activeView === "attendance" ? "erp-button-primary" : "erp-button-secondary"}`} onClick={() => selectView("attendance")}>Chấm công</button>
        </div>
      </section>
      <div
        role="tabpanel"
        aria-label="Nhập sản lượng"
        hidden={activeView !== "production"}
        aria-hidden={activeView !== "production"}
      >
        {visitedViews.production && <ProductionEntryManagerMatrixPage {...props} />}
      </div>
      <div
        role="tabpanel"
        aria-label="Chấm công"
        hidden={activeView !== "attendance"}
        aria-hidden={activeView !== "attendance"}
      >
        {visitedViews.attendance && <AttendancePage />}
      </div>
    </div>
  );
}
