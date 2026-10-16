import React, { useMemo } from "react";
import { dateRangeAxis } from "./productionMonthlyMatrix.js";
import { buildWeekGrid, weekGridDayStatus } from "./productionWeekGridModel.js";
import "./ProductionWeekGrid.css";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const n = (value) => numberFormat.format(Number(value ?? 0));
const isoToday = (today) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const dayClass = (day, todayIso) => [day.isSunday ? "is-sun" : "", day.weekdayLabel === "T7" ? "is-sat" : "", day.isoDate === todayIso ? "is-today" : ""].filter(Boolean).join(" ");

function lineTotals(line, axis) {
  let hc = 0;
  let tc = 0;
  for (const day of axis) {
    const cell = line.cells.get(day.isoDate);
    hc += Number(cell?.hcQuantity ?? 0);
    tc += Number(cell?.tcQuantity ?? 0);
  }
  return { hc, tc };
}

/**
 * Week of production laid out like the Excel export: Nhân viên · Mã SX · CĐ · ĐVT, then per day HC | TC | Tổng
 * (or only Tổng in compact mode). Every person with output or attendance this week has a block.
 */
export function ProductionWeekGrid({ data, fromDate, untilDate, compact = false, loading = false, error = "", onCellClick, onDayHeaderClick, onPendingDayClick, today = new Date() }) {
  const todayIso = isoToday(today);
  const axis = useMemo(() => dateRangeAxis(fromDate, untilDate, false), [fromDate, untilDate]);
  const grid = useMemo(() => buildWeekGrid(data), [data]);
  const span = compact ? 1 : 3;

  if (loading) return <div className="erp-table-state">Đang tải sản lượng...</div>;
  if (error) return <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>;
  if (grid.employees.length === 0) return <div className="erp-week-empty">Tuần này chưa có sản lượng hay chấm công. Bấm "Nhập sản lượng" hoặc bấm vào một ngày để nhập nhanh.</div>;

  function dayCells(employee, line, lineIndex, day, start) {
    const { status, cell } = weekGridDayStatus(employee, line, day.isoDate, todayIso, lineIndex);
    const base = `${start ? "is-day-start " : ""}${dayClass(day, todayIso)}`;
    const label = `${employee.employeeName}${line ? ` · ${line.order.orderCode} CĐ${line.operation.operationNumber}` : ""} · ${day.weekdayLabel} ${day.displayDate}`;
    const open = () => {
      if (line) onCellClick?.({ cell, order: line.order, employee: line.employee, operation: line.operation, workDate: day.isoDate });
      else onPendingDayClick?.(employee, day);
    };
    if (status === "future" || status === "locked") {
      return [<td key={day.isoDate} colSpan={span} className={`erp-week-cell is-${status} ${base}`} aria-label={`${label} · ${status === "future" ? "chưa tới ngày" : "đã nghỉ việc"}`} />];
    }
    if (status === "missing" || status === "leave" || (!line && status === "empty")) {
      const text = status === "missing" ? "!" : status === "leave" ? "P" : "";
      const title = status === "missing" ? "Đã đi làm, chưa nhập công đoạn" : status === "leave" ? "Nghỉ phép" : "Chưa có dữ liệu";
      const clickable = Boolean(line || status === "missing");
      return [<td key={day.isoDate} colSpan={span} className={`erp-week-cell is-${status} ${base}`} data-date={day.isoDate}>{clickable ? <button type="button" onClick={open} title={title} aria-label={`${label} · ${title}`}>{text}</button> : <span title={title}>{text}</span>}</td>];
    }
    const hc = Number(cell?.hcQuantity ?? 0);
    const tc = Number(cell?.tcQuantity ?? 0);
    const zero = (value) => value === 0 ? " is-zero" : "";
    const button = (value, part) => <button type="button" onClick={open} aria-label={`${label} · ${part} ${n(value)}`}>{n(value)}{part === "Tổng" && cell?.entryCount > 1 ? <sup>{cell.entryCount}</sup> : null}</button>;
    if (compact) return [<td key={day.isoDate} className={`erp-week-cell is-total${zero(hc + tc)} ${base}`} data-date={day.isoDate}>{button(hc + tc, "Tổng")}</td>];
    return [
      <td key={`${day.isoDate}-hc`} className={`erp-week-cell is-hc${zero(hc)} ${base}`} data-date={day.isoDate}>{button(hc, "HC")}</td>,
      <td key={`${day.isoDate}-tc`} className={`erp-week-cell is-tc${zero(tc)} ${dayClass(day, todayIso)}`} data-date={day.isoDate}>{button(tc, "TC")}</td>,
      <td key={`${day.isoDate}-all`} className={`erp-week-cell is-total${zero(hc + tc)} ${dayClass(day, todayIso)}`} data-date={day.isoDate}>{button(hc + tc, "Tổng")}</td>,
    ];
  }

  const rows = [];
  for (const employee of grid.employees) {
    const lines = employee.lines.length > 0 ? employee.lines : [null];
    lines.forEach((line, index) => {
      const totals = line ? lineTotals(line, axis) : { hc: 0, tc: 0 };
      const last = index === lines.length - 1;
      rows.push(
        <tr key={`${employee.employeeId}-${line ? `${line.order.orderId}-${line.operation.operationId}` : "none"}`} className={last ? "is-employee-end" : ""}>
          {index === 0 && <th scope="rowgroup" rowSpan={lines.length} className="erp-week-fix erp-week-c1 erp-week-employee">
            <span>{employee.employeeName}</span>
            <small>{employee.employeeCode}{employee.kind === "hourly" ? " · theo giờ" : ""}{employee.isActive === false ? " · đã tắt" : ""}</small>
          </th>}
          <td className={`erp-week-fix erp-week-c2${line ? "" : " is-pending"}`}>{line ? line.order.orderCode : employee.kind === "hourly" ? "Theo giờ" : "Chưa nhập"}</td>
          <td className="erp-week-fix erp-week-c3">{line ? `CĐ${line.operation.operationNumber}` : "—"}</td>
          <td className="erp-week-fix erp-week-c4">{line?.operation.unit ?? ""}</td>
          {axis.flatMap((day, dayIndex) => dayCells(employee, line, index, day, dayIndex > 0))}
          <td className="erp-week-sum is-hc is-day-start">{line ? n(totals.hc) : ""}</td>
          <td className="erp-week-sum is-tc">{line ? n(totals.tc) : ""}</td>
          <td className="erp-week-sum is-all">{line ? n(totals.hc + totals.tc) : ""}</td>
        </tr>,
      );
    });
  }

  return (
    <div className="erp-week-wrap" role="region" aria-label="Bảng sản lượng tuần" tabIndex="0">
      <table className={`erp-week-grid${compact ? " is-compact" : ""}`}>
        <thead>
          <tr>
            <th rowSpan={2} className="erp-week-fix erp-week-c1">Nhân viên</th>
            <th rowSpan={2} className="erp-week-fix erp-week-c2">Mã SX</th>
            <th rowSpan={2} className="erp-week-fix erp-week-c3">CĐ</th>
            <th rowSpan={2} className="erp-week-fix erp-week-c4">ĐVT</th>
            {axis.map((day, index) => (
              <th key={day.isoDate} colSpan={span} className={`erp-week-day ${index > 0 ? "is-day-start " : ""}${dayClass(day, todayIso)}`} aria-current={day.isoDate === todayIso ? "date" : undefined}>
                <button type="button" onClick={() => onDayHeaderClick?.(day)} title="Nhập nhanh nhiều người trong ngày" aria-label={`Nhập nhanh ngày ${day.weekdayLabel} ${day.displayDate}`}>{day.weekdayLabel} {day.displayDate}</button>
              </th>
            ))}
            <th colSpan={3} className="erp-week-day is-day-start">Cả tuần</th>
          </tr>
          <tr>
            {axis.flatMap((day, index) => compact ? [
              <th key={`${day.isoDate}-all`} className={`erp-week-sub${index > 0 ? " is-day-start" : ""}`}>Tổng</th>,
            ] : [
              <th key={`${day.isoDate}-hc`} className={`erp-week-sub is-hc${index > 0 ? " is-day-start" : ""}`}>HC</th>,
              <th key={`${day.isoDate}-tc`} className="erp-week-sub is-tc">TC</th>,
              <th key={`${day.isoDate}-all`} className="erp-week-sub">Tổng</th>,
            ])}
            <th className="erp-week-sub is-hc is-day-start">HC</th><th className="erp-week-sub is-tc">TC</th><th className="erp-week-sub">Tổng</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
        <tfoot>
          <tr>
            <td className="erp-week-fix erp-week-c1">TỔNG</td><td className="erp-week-fix erp-week-c2" /><td className="erp-week-fix erp-week-c3" /><td className="erp-week-fix erp-week-c4" />
            {axis.flatMap((day, index) => {
              const totals = grid.totalsByDate[day.isoDate] ?? { hc: 0, tc: 0 };
              const start = index > 0 ? " is-day-start" : "";
              if (compact) return [<td key={day.isoDate} className={`erp-week-foot${start}`}>{n(totals.hc + totals.tc)}</td>];
              return [
                <td key={`${day.isoDate}-hc`} className={`erp-week-foot is-hc${start}`}>{n(totals.hc)}</td>,
                <td key={`${day.isoDate}-tc`} className="erp-week-foot is-tc">{n(totals.tc)}</td>,
                <td key={`${day.isoDate}-all`} className="erp-week-foot">{n(totals.hc + totals.tc)}</td>,
              ];
            })}
            <td className="erp-week-foot is-hc is-day-start">{n(grid.total.hc)}</td><td className="erp-week-foot is-tc">{n(grid.total.tc)}</td><td className="erp-week-foot is-all">{n(grid.total.hc + grid.total.tc)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
