import React, { useMemo, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Icon } from "../../components/erp/Icon.jsx";
import { dayLabel, formatQuantity, normalizeSearch } from "./employeeMonthlyTotals.js";

function SummaryCard({ label, value, hint, tone }) {
  return (
    <div className={`erp-emp-summary-card${tone ? ` is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{formatQuantity(value)}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function hours(value) {
  return value ? formatQuantity(value) : "–";
}

export function EmployeeAttendanceTab({ view, loading, error, search }) {
  const [openEmployees, setOpenEmployees] = useState(() => new Set());
  const keyword = normalizeSearch(search);
  const visible = useMemo(
    () => (keyword ? view.rows.filter((row) => normalizeSearch(`${row.name} ${row.code}`).includes(keyword)) : view.rows),
    [view.rows, keyword],
  );

  function toggle(id) {
    setOpenEmployees((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const rows = [];
  for (const row of visible) {
    const open = openEmployees.has(row.employeeId);
    rows.push(
      <tr key={row.employeeId} className={`erp-emp-row-person${open ? " is-open" : ""}`}>
        <td>
          <button type="button" className="erp-emp-toggle" aria-expanded={open} onClick={() => toggle(row.employeeId)}>
            <span className={`erp-emp-chevron${open ? " is-open" : ""}`} aria-hidden="true"><Icon name="chevronRight" size={16} /></span>
            <span className="erp-emp-name">{row.name}</span>
            <span className="erp-emp-meta">{row.code}{row.isActive ? "" : " · đã nghỉ"} · {row.workDays} ngày làm</span>
          </button>
        </td>
        <td className="erp-report-number erp-emp-total">{hours(row.regular)}</td>
        <td className="erp-report-number">{hours(row.overtime)}</td>
        <td className="erp-report-number">{hours(row.paidLeave)}</td>
        <td className="erp-report-number">{hours(row.sickLeave)}</td>
        <td className="erp-report-number">{formatQuantity(row.outputTotal)}</td>
        <td className="erp-emp-flag-cell">
          {row.missingOutputDays > 0 && <span className="erp-emp-flag is-warning" title="Ngày có chấm công nhưng chưa có sản lượng">{row.missingOutputDays} ngày chưa có SL</span>}
          {row.noAttendanceDays > 0 && <span className="erp-emp-flag is-info" title="Ngày có sản lượng nhưng chưa chấm công">{row.noAttendanceDays} ngày chưa chấm công</span>}
        </td>
      </tr>
    );
    if (!open) continue;
    for (const day of row.days) {
      const label = dayLabel(day.date);
      const state = day.paidLeave ? "Nghỉ phép (P)" : day.sickLeave ? "Nghỉ ốm (Ô)" : day.missingOutput ? "Chưa có sản lượng" : day.noAttendance ? "Chưa chấm công" : "";
      rows.push(
        <tr key={`${row.employeeId}|${day.date}`} className={`erp-emp-row-day${label.isSunday ? " is-sunday" : ""}${day.missingOutput ? " is-missing" : ""}${day.noAttendance ? " is-no-attendance" : ""}`}>
          <td><span className="erp-emp-day"><b>{label.weekday}</b> {label.display}</span></td>
          <td className="erp-report-number">{hours(day.regular)}</td>
          <td className="erp-report-number">{hours(day.overtime)}</td>
          <td className="erp-report-number">{day.paidLeave ? "P" : "–"}</td>
          <td className="erp-report-number">{day.sickLeave ? "Ô" : "–"}</td>
          <td className="erp-report-number">{day.output ? formatQuantity(day.output) : "–"}</td>
          <td className="erp-emp-flag-cell">{state && <span className="erp-emp-state">{state}</span>}</td>
        </tr>
      );
    }
  }

  return (
    <>
      {error && <Alert variant="error" title="Không thể tải chấm công.">{error}</Alert>}
      <div className="erp-emp-summary" aria-label="Tổng kết chấm công tháng">
        <SummaryCard label="Số người có chấm công / sản lượng" value={view.summary.employeeCount} />
        <SummaryCard label="Tổng giờ HC" value={view.summary.regular} />
        <SummaryCard label="Tổng giờ TC" value={view.summary.overtime} />
        <SummaryCard label="Ngày có công chưa có sản lượng" value={view.summary.missingOutputDays} hint="cần kiểm tra" tone={view.summary.missingOutputDays > 0 ? "warning" : undefined} />
      </div>
      {loading && <div className="erp-report-state">Đang tải chấm công...</div>}
      {!loading && !error && view.rows.length === 0 && <div className="erp-report-state">Tháng này chưa có chấm công.</div>}
      {!loading && !error && view.rows.length > 0 && visible.length === 0 && <div className="erp-report-state">Không có người nào khớp "{search}".</div>}
      {!loading && visible.length > 0 && (
        <div className="erp-emp-table-wrap">
          <table className="erp-emp-table erp-emp-table-attendance">
            <thead>
              <tr>
                <th>Người / Ngày</th>
                <th className="erp-report-number">Giờ HC</th>
                <th className="erp-report-number">Giờ TC</th>
                <th className="erp-report-number">Nghỉ phép</th>
                <th className="erp-report-number">Nghỉ ốm</th>
                <th className="erp-report-number">Sản lượng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
