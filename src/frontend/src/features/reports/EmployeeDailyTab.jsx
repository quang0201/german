import React, { useMemo, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { formatQuantity, normalizeSearch } from "./employeeMonthlyTotals.js";
import "./EmployeeDailyTab.css";

const MODES = [
  { key: "all", label: "Số cái + giờ" },
  { key: "qty", label: "Chỉ số cái" },
  { key: "overtime", label: "Chỉ tăng ca" },
];

function SummaryCard({ label, value }) {
  return (
    <div className="erp-emp-summary-card">
      <span>{label}</span>
      <strong>{formatQuantity(value)}</strong>
    </div>
  );
}

function DayCell({ cell, mode, isSunday }) {
  const className = `erp-emp-daycell${isSunday ? " is-sunday" : ""}`;
  if (!cell) return <td className={className}><span className="erp-emp-daycell-empty">·</span></td>;
  const hasOutput = cell.total > 0;
  const hours = cell.regular > 0 || cell.overtime > 0;
  if (mode === "overtime") {
    return (
      <td className={className}>
        {cell.tc > 0 && <span className="erp-emp-daycell-total">{formatQuantity(cell.tc)}</span>}
        {cell.overtime > 0 && <span className="erp-emp-daycell-hours is-overtime">{formatQuantity(cell.overtime)}h TC</span>}
        {cell.tc === 0 && cell.overtime === 0 && <span className="erp-emp-daycell-empty">·</span>}
      </td>
    );
  }
  return (
    <td className={className}>
      {cell.leave && <span className="erp-emp-daycell-leave">{cell.leave}</span>}
      {hasOutput && <span className="erp-emp-daycell-total">{formatQuantity(cell.total)}</span>}
      {mode === "all" && hasOutput && <span className="erp-emp-daycell-split">{formatQuantity(cell.hc)} / <b>{formatQuantity(cell.tc)}</b></span>}
      {mode === "all" && hours && <span className="erp-emp-daycell-hours">{formatQuantity(cell.regular)}h{cell.overtime > 0 ? ` + ${formatQuantity(cell.overtime)}h TC` : ""}</span>}
      {!hasOutput && !hours && !cell.leave && <span className="erp-emp-daycell-empty">·</span>}
    </td>
  );
}

export function EmployeeDailyTab({ view, loading, error, search }) {
  const [mode, setMode] = useState("all");
  const [onlyOutput, setOnlyOutput] = useState(true);
  const keyword = normalizeSearch(search);
  const visible = useMemo(
    () => view.rows.filter((row) => (!onlyOutput || row.totals.total > 0) && (!keyword || normalizeSearch(`${row.name} ${row.code}`).includes(keyword))),
    [view.rows, onlyOutput, keyword],
  );

  const footer = useMemo(() => {
    const byDay = {};
    const sum = { hc: 0, tc: 0, total: 0, overtime: 0 };
    for (const row of visible) {
      sum.hc += row.totals.hc; sum.tc += row.totals.tc; sum.total += row.totals.total; sum.overtime += row.totals.overtime;
      for (const [date, cell] of Object.entries(row.cells)) byDay[date] = (byDay[date] ?? 0) + cell.total;
    }
    return { byDay, sum };
  }, [visible]);

  return (
    <>
      {error && <Alert variant="error" title="Không thể tải chấm công.">{error}</Alert>}
      <div className="erp-emp-summary" aria-label="Tổng kết tháng">
        <SummaryCard label="Số người đang xem" value={visible.length} />
        <SummaryCard label="Tổng HC" value={footer.sum.hc} />
        <SummaryCard label="Tổng TC" value={footer.sum.tc} />
        <SummaryCard label="Tổng giờ tăng ca" value={footer.sum.overtime} />
      </div>
      <div className="erp-emp-daily-options">
        <div className="erp-emp-segment" role="group" aria-label="Kiểu hiển thị">
          {MODES.map((item) => (
            <button key={item.key} type="button" className={mode === item.key ? "is-active" : ""} aria-pressed={mode === item.key} onClick={() => setMode(item.key)}>{item.label}</button>
          ))}
        </div>
        <label className="erp-emp-check">
          <input type="checkbox" checked={onlyOutput} onChange={(event) => setOnlyOutput(event.target.checked)} />
          Chỉ người có sản lượng
        </label>
        <span className="erp-emp-legend">Mỗi ô: tổng số cái; dòng nhỏ: HC / <b>TC</b>; dòng xanh: giờ làm + giờ tăng ca. Cột nền màu là Chủ nhật. P = nghỉ phép, Ô = nghỉ ốm.</span>
      </div>
      {loading && <div className="erp-report-state">Đang tải dữ liệu theo ngày...</div>}
      {!loading && !error && view.rows.length === 0 && <div className="erp-report-state">Tháng này chưa có dữ liệu.</div>}
      {!loading && !error && view.rows.length > 0 && visible.length === 0 && <div className="erp-report-state">Không có người nào khớp.</div>}
      {!loading && visible.length > 0 && (
        <div className="erp-emp-table-wrap erp-emp-daily-wrap">
          <table className="erp-emp-table erp-emp-table-daily">
            <thead>
              <tr>
                <th className="erp-emp-daily-name">Người</th>
                {view.days.map((day) => <th key={day.date} className={`erp-emp-daycell${day.isSunday ? " is-sunday" : ""}`}>{day.day}</th>)}
                <th className="erp-report-number">HC</th>
                <th className="erp-report-number">TC</th>
                <th className="erp-report-number">Tổng</th>
                <th className="erp-report-number">Giờ TC</th>
                <th className="erp-report-number">Ngày công</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.employeeId}>
                  <td className="erp-emp-daily-name"><span className="erp-emp-name">{row.name}</span><span className="erp-emp-meta">{row.code}{row.isActive ? "" : " · đã nghỉ"}</span></td>
                  {view.days.map((day) => <DayCell key={day.date} cell={row.cells[day.date]} mode={mode} isSunday={day.isSunday} />)}
                  <td className="erp-report-number">{formatQuantity(row.totals.hc)}</td>
                  <td className="erp-report-number">{formatQuantity(row.totals.tc)}</td>
                  <td className="erp-report-number erp-emp-total">{formatQuantity(row.totals.total)}</td>
                  <td className="erp-report-number">{formatQuantity(row.totals.overtime)}</td>
                  <td className="erp-report-number">{formatQuantity(row.totals.workDays)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="erp-emp-daily-name">Cộng</td>
                {view.days.map((day) => {
                  const total = footer.byDay[day.date];
                  return <td key={day.date} className={`erp-emp-daycell${day.isSunday ? " is-sunday" : ""}`}>{total ? <span className="erp-emp-daycell-total">{formatQuantity(total)}</span> : ""}</td>;
                })}
                <td className="erp-report-number">{formatQuantity(footer.sum.hc)}</td>
                <td className="erp-report-number">{formatQuantity(footer.sum.tc)}</td>
                <td className="erp-report-number erp-emp-total">{formatQuantity(footer.sum.total)}</td>
                <td className="erp-report-number">{formatQuantity(footer.sum.overtime)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
