import React, { useState } from "react";
import { AttendancePage } from "../attendance/AttendancePage.jsx";
import { ProductionEntryManagerMatrixPage } from "./ProductionEntryManagerMatrixPage.jsx";
import "./ProductionAttendanceWorkspace.css";

export function ProductionAttendanceWorkspace(props) {
  const [activeView, setActiveView] = useState("production");

  return (
    <div className="erp-production-attendance-workspace">
      <section className="erp-production-attendance-switcher" aria-label="Chọn màn nhập liệu">
        <div>
          <span className="erp-page-eyebrow">Nhập liệu chung</span>
          <h1>Nhập liệu sản lượng và chấm công</h1>
          <p>Một màn hình cho phép chuyển nhanh giữa sản lượng và giờ công của cùng kỳ làm việc.</p>
        </div>
        <div className="erp-production-attendance-tabs" role="tablist" aria-label="Loại dữ liệu nhập">
          <button type="button" role="tab" aria-selected={activeView === "production"} className={`erp-button ${activeView === "production" ? "erp-button-primary" : "erp-button-secondary"}`} onClick={() => setActiveView("production")}>Nhập sản lượng</button>
          <button type="button" role="tab" aria-selected={activeView === "attendance"} className={`erp-button ${activeView === "attendance" ? "erp-button-primary" : "erp-button-secondary"}`} onClick={() => setActiveView("attendance")}>Chấm công</button>
        </div>
      </section>
      <div role="tabpanel" aria-label={activeView === "production" ? "Nhập sản lượng" : "Chấm công"}>
        {activeView === "production" ? <ProductionEntryManagerMatrixPage {...props} /> : <AttendancePage />}
      </div>
    </div>
  );
}
