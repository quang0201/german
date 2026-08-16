import React, { useMemo } from "react";
import { attendanceDayKey, calculateDisplayTotals } from "./attendanceModel.js";

const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function dayLabel(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return { weekday: weekdayLabels[date.getUTCDay()], date: isoDate.slice(8, 10) };
}

function cellDraft(drafts, employeeId, day, slotNumber) {
  return drafts[attendanceDayKey(employeeId, day.workDate)]?.shifts?.[slotNumber] ?? "";
}

function draftDay(drafts, employee, day) {
  const key = attendanceDayKey(employee.employeeId, day.workDate);
  return drafts[key] ?? {
    overtimeHours: day.overtimeHours ? String(day.overtimeHours) : "",
    shifts: Object.fromEntries((day.shifts ?? []).map((shift) => [shift.slotNumber, ""])),
  };
}

export function AttendanceMonthlyMatrix({ data, drafts, onCellChange, onOvertimeChange, loading, onLoadMore, loadingMore, onRetryBlock }) {
  const employees = data?.employees ?? [];
  const days = employees[0]?.days ?? [];

  if (loading) return <div className="erp-empty-state">Đang tải dữ liệu chấm công...</div>;
  if (!employees.length) return <div className="erp-empty-state">Chưa có nhân viên đang hoạt động.</div>;

  return (
    <section className="erp-attendance-matrix-section" aria-label="Ma trận chấm công">
      <div className="erp-attendance-matrix-scroll" onScroll={(event) => {
        const target = event.currentTarget;
        if (target.scrollTop + target.clientHeight >= target.scrollHeight - 400) onLoadMore?.();
      }}>
        <table className="erp-attendance-matrix-table">
          <thead>
            <tr>
              <th className="erp-attendance-sticky-employee" rowSpan="2">Nhân viên</th>
              <th className="erp-attendance-sticky-shift" rowSpan="2">Ca</th>
              {days.map((day) => {
                const label = dayLabel(day.workDate);
                return <th key={day.workDate} colSpan="1" className={label.weekday === "CN" ? "erp-attendance-sunday" : ""}><span>{label.weekday}</span><strong>{label.date}</strong></th>;
              })}
              <th rowSpan="2" className="erp-attendance-total">Giờ HC</th>
              <th rowSpan="2" className="erp-attendance-total">Giờ TC</th>
              <th rowSpan="2" className="erp-attendance-total">Nghỉ P</th>
              <th rowSpan="2" className="erp-attendance-total">Nghỉ Ô</th>
            </tr>
            <tr>{days.map((day) => <th key={`sub-${day.workDate}`} className="erp-attendance-day-sub">Giờ</th>)}</tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const dayMap = new Map((employee.days ?? []).map((day) => [day.workDate, day]));
              const maxSlots = Math.max(0, ...(employee.days ?? []).map((day) => day.shifts?.length ?? 0));
              const totals = calculateDisplayTotals(employee, drafts);
              const rowCount = maxSlots + 1;
              return Array.from({ length: rowCount }, (_, rowIndex) => {
                const isTc = rowIndex === maxSlots;
                const slotNumber = rowIndex + 1;
                return (
                  <tr key={`${employee.employeeId}-${isTc ? "tc" : slotNumber}`}>
                    {rowIndex === 0 && <th className="erp-attendance-sticky-employee erp-attendance-employee" rowSpan={rowCount}>{employee.employeeCode}<span>{employee.fullName}</span></th>}
                    <th className="erp-attendance-sticky-shift erp-attendance-shift-name">{isTc ? "TC" : `Ca ${slotNumber}`}</th>
                    {days.map((headerDay) => {
                      const day = dayMap.get(headerDay.workDate);
                      const shift = day?.shifts?.find((item) => item.slotNumber === slotNumber);
                      const key = attendanceDayKey(employee.employeeId, headerDay.workDate);
                      const draft = draftDay(drafts, employee, day ?? headerDay);
                      if (isTc) {
                        return <td key={`${key}-tc`} className="erp-attendance-tc-cell"><input className="erp-control erp-attendance-cell" inputMode="decimal" aria-label={`${employee.fullName} TC ${headerDay.workDate}`} value={draft.overtimeHours} disabled={!day?.hasShiftSetup} onChange={(event) => onOvertimeChange(employee, headerDay, event.target.value)} /></td>;
                      }
                      return <td key={`${key}-${slotNumber}`}><input className="erp-control erp-attendance-cell" aria-label={`${employee.fullName} Ca ${slotNumber} ${headerDay.workDate}`} value={shift ? cellDraft(drafts, employee.employeeId, headerDay, slotNumber) : ""} disabled={!shift} onChange={(event) => onCellChange(employee, headerDay, shift, event.target.value)} /></td>;
                    })}
                    {rowIndex === 0 && <>
                      <td rowSpan={rowCount} className="erp-attendance-total">{totals.regularWorkedHours}</td>
                      <td rowSpan={rowCount} className="erp-attendance-total">{totals.overtimeHours}</td>
                      <td rowSpan={rowCount} className="erp-attendance-total">{totals.paidLeaveHours}</td>
                      <td rowSpan={rowCount} className="erp-attendance-total">{totals.sickLeaveHours}</td>
                    </>}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
        {Object.values(data.blockStatus ?? {}).some((status) => status === "loading") && <div className="erp-attendance-block-loading">Đang tải dữ liệu ngày...</div>}
        {Object.entries(data.blockErrors ?? {}).filter(([, message]) => message).map(([blockKey, message]) => <div key={blockKey} className="erp-attendance-block-error"><span>{message}</span><button type="button" className="erp-button erp-button-secondary" onClick={() => onRetryBlock?.(blockKey)}>Thử lại</button></div>)}
        {data.hasMoreEmployees && <div className="erp-attendance-load-more">{loadingMore ? "Đang tải thêm nhân viên..." : "Cuộn xuống để tải thêm nhân viên"}</div>}
      </div>
    </section>
  );
}
