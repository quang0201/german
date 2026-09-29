import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Icon } from "../../components/erp/Icon.jsx";
import { dateRangeAxis, isEmployeeNewInPeriod, isFutureProductionDate, mergeHourlyEmployeesIntoOrders, monthBounds, monthDateAxis, monthLabel } from "./productionMonthlyMatrix.js";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const quantity = (value) => numberFormat.format(Number(value ?? 0));
const cellsByDate = (operation) => new Map((operation.cells ?? []).map((cell) => [cell.workDate, cell]));
const matrixHoverStates = new WeakMap();

function getMatrixHoverState(table) {
  let state = matrixHoverStates.get(table);
  if (state) return state;
  const columns = new Map();
  table.querySelectorAll("td[data-date]").forEach((item) => {
    const cells = columns.get(item.dataset.date) ?? [];
    cells.push(item);
    columns.set(item.dataset.date, cells);
  });
  const dayHeaders = new Map([...table.querySelectorAll("thead button[data-date]")].map((button) => [button.dataset.date, button.closest("th")]));
  state = { columns, dayHeaders, date: null, row: null, cell: null, header: null };
  matrixHoverStates.set(table, state);
  return state;
}

function setMatrixHoverCell(table, cell) {
  const state = getMatrixHoverState(table);
  const date = cell?.dataset.date ?? null;
  const row = cell?.closest("tr") ?? null;
  const header = date ? state.dayHeaders.get(date) ?? null : null;
  if (state.date !== date) {
    state.columns.get(state.date)?.forEach((item) => item.classList.remove("erp-month-hover-column"));
    state.columns.get(date)?.forEach((item) => item.classList.add("erp-month-hover-column"));
    state.header?.classList.remove("erp-month-hover-day");
    header?.classList.add("erp-month-hover-day");
  }
  if (state.row !== row) {
    state.row?.classList.remove("erp-month-hover-row");
    row?.classList.add("erp-month-hover-row");
  }
  if (state.cell !== cell) {
    state.cell?.classList.remove("erp-month-hover-cell");
    cell?.classList.add("erp-month-hover-cell");
  }
  state.date = date;
  state.row = row;
  state.cell = cell;
  state.header = header;
}

export function ProductionMonthlyMatrix({ data, monthKey, fromDate = "", untilDate = "", selectedOrderId = "", excludeSundays = true, showSundayToggle = true, showOrderFilter = true, loading = false, error = "", onSelectOrder, onToggleSundays, onCellClick, onDayHeaderClick, today = new Date() }) {
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const range = useMemo(() => fromDate && untilDate ? { fromDate, untilDate } : monthBounds(monthKey), [fromDate, untilDate, monthKey]);
  const axis = useMemo(() => fromDate && untilDate ? dateRangeAxis(fromDate, untilDate, excludeSundays) : monthDateAxis(monthKey, excludeSundays), [fromDate, untilDate, monthKey, excludeSundays]);
  const rangeLabel = fromDate && untilDate ? `${range.fromDate.split("-").reverse().join("/")} – ${range.untilDate.split("-").reverse().join("/")}` : monthLabel(monthKey);
  const scrollRef = useRef(null);
  const scrollLeftRef = useRef(0);
  const hoverTooltipRef = useRef(null);
  const hoverTooltipTimerRef = useRef(null);
  const availableOrders = data?.availableOrders ?? [];
  const hourlyEmployees = data?.hourlyEmployees ?? [];
  const orders = useMemo(() => mergeHourlyEmployeesIntoOrders(data?.orders ?? [], hourlyEmployees), [data?.orders, hourlyEmployees]);

  useEffect(() => {
    scrollLeftRef.current = 0;
  }, [monthKey, selectedOrderId]);

  useLayoutEffect(() => {
    if (hoverTooltipTimerRef.current) clearTimeout(hoverTooltipTimerRef.current);
    const table = scrollRef.current?.querySelector("table");
    if (table) {
      setMatrixHoverCell(table, null);
      matrixHoverStates.delete(table);
    }
    if (!loading && !error && scrollRef.current) {
      const todayButton = todayIso >= range.fromDate && todayIso <= range.untilDate
        ? scrollRef.current.querySelector(`[data-date="${todayIso}"]`)
        : null;
      const nextScrollLeft = todayButton
        ? Math.max(0, todayButton.offsetLeft - 220)
        : scrollLeftRef.current;
      if (!todayButton) {
        scrollRef.current.scrollLeft = scrollLeftRef.current;
        return;
      }
      scrollRef.current.scrollLeft = nextScrollLeft;
      scrollLeftRef.current = nextScrollLeft;
    }
  }, [loading, error, monthKey, fromDate, untilDate, selectedOrderId, excludeSundays, todayIso, range.fromDate, range.untilDate, orders]);

  function showCellTooltip(table, cell) {
    const tooltip = hoverTooltipRef.current;
    if (!cell) {
      setMatrixHoverCell(table, null);
      if (tooltip) {
        tooltip.hidden = true;
        tooltip.setAttribute("aria-hidden", "true");
        tooltip.dataset.content = "";
      }
      return;
    }
    setMatrixHoverCell(table, cell);
    const button = cell.querySelector("button");
    if (!button || !tooltip) return;
    if (tooltip.dataset.content === button.title) {
      tooltip.hidden = false;
      tooltip.setAttribute("aria-hidden", "false");
      return;
    }
    const rect = button.getBoundingClientRect();
    const tooltipWidth = Math.min(300, window.innerWidth - 16);
    const tooltipHeight = Math.min(176, window.innerHeight - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltipWidth - 8));
    const top = rect.bottom + tooltipHeight + 12 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - tooltipHeight - 8);
    tooltip.replaceChildren(...button.title.split("\n").map((line, index) => {
      const element = document.createElement(index === 0 ? "strong" : "span");
      element.textContent = line;
      return element;
    }));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.width = `${tooltipWidth}px`;
    tooltip.dataset.content = button.title;
    tooltip.hidden = false;
    tooltip.setAttribute("aria-hidden", "false");
  }

  function handleMatrixMouseOver(event) {
    const cell = event.target.closest?.("td[data-date]");
    const previousCell = event.relatedTarget?.closest?.("td[data-date]");
    if (cell === previousCell) return;
    const table = event.currentTarget;
    const nextCell = cell && table.contains(cell) ? cell : null;
    if (hoverTooltipTimerRef.current) clearTimeout(hoverTooltipTimerRef.current);
    if (!nextCell) {
      showCellTooltip(table, null);
      return;
    }
    setMatrixHoverCell(table, nextCell);
    if (hoverTooltipRef.current?.dataset.content === nextCell.querySelector("button")?.title && !hoverTooltipRef.current.hidden) return;
    hoverTooltipTimerRef.current = setTimeout(() => showCellTooltip(table, nextCell), 140);
  }

  function handleMatrixFocus(event) {
    const cell = event.target.closest?.("td[data-date]");
    if (cell) {
      if (hoverTooltipTimerRef.current) clearTimeout(hoverTooltipTimerRef.current);
      showCellTooltip(event.currentTarget, cell);
    }
  }

  function clearMatrixTooltip(event) {
    if (hoverTooltipTimerRef.current) clearTimeout(hoverTooltipTimerRef.current);
    setMatrixHoverCell(event.currentTarget, null);
    if (hoverTooltipRef.current) {
      hoverTooltipRef.current.hidden = true;
      hoverTooltipRef.current.setAttribute("aria-hidden", "true");
      hoverTooltipRef.current.dataset.content = "";
    }
  }

  return (
    <section className={`erp-month-matrix-section${orders.length === 0 ? " erp-month-matrix-empty" : ""}`} aria-label={`Sản lượng ${rangeLabel}`}>
      {(showOrderFilter || showSundayToggle) && <div className="erp-month-matrix-toolbar">
        {showOrderFilter && <div className="erp-month-order-filter" role="group" aria-label="Lọc Mã SX">
          {availableOrders.length === 0 ? <strong>{rangeLabel}</strong> : <select className="erp-control erp-month-order-filter-select" aria-label="Lọc Mã SX" value={selectedOrderId} onChange={(event) => onSelectOrder?.(event.target.value)}>{availableOrders.map((order) => <option key={order.id} value={order.id}>{order.code} — {order.productName}</option>)}</select>}
        </div>}
        {showSundayToggle && <label className="erp-month-sunday-toggle"><input type="checkbox" checked={excludeSundays} onChange={(event) => onToggleSundays?.(event.target.checked)} /><span>Ẩn Chủ nhật</span></label>}
      </div>}
      {error && <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>}
      <div className="erp-month-matrix-legend" role="list" aria-label="Chú giải màu trạng thái">
        <span role="listitem"><i className="is-no-attendance" aria-hidden="true">?</i>Chưa chấm công</span>
        <span role="listitem"><i className="is-missing-operation" aria-hidden="true">!</i>Chưa nhập công đoạn</span>
        <span role="listitem"><i className="is-paid-leave" aria-hidden="true">P</i>Nghỉ phép</span>
        <span role="listitem"><i className="is-future-date" aria-hidden="true">—</i>Chưa tới ngày</span>
      </div>
      <div className="erp-month-matrix-help"><Icon name="info" size={15} /><span>Chọn ngày để nhập nhanh nhiều người · Bấm ô tổng để nhập hoặc sửa chi tiết HC/TC</span></div>
      {orders.length === 0 && !loading && !error && <div className="erp-month-empty-state">Chưa có sản lượng. Bấm vào ngày phía trên để nhập nhanh nhiều công đoạn.</div>}
      {loading && <div className="erp-table-state">Đang tải sản lượng...</div>}
      {!loading && !error && <>
        <div className="erp-month-matrix-scroll-hint" aria-hidden="true">Cuộn ngang để xem các ngày khác <span>→</span></div>
        <div ref={scrollRef} onScroll={(event) => { scrollLeftRef.current = event.currentTarget.scrollLeft; if (hoverTooltipTimerRef.current) clearTimeout(hoverTooltipTimerRef.current); const table = event.currentTarget.querySelector("table"); if (table) setMatrixHoverCell(table, null); if (hoverTooltipRef.current) { hoverTooltipRef.current.hidden = true; hoverTooltipRef.current.setAttribute("aria-hidden", "true"); hoverTooltipRef.current.dataset.content = ""; } }} className="erp-month-matrix-scroll" role="region" aria-label="Ma trận sản lượng; cuộn ngang để xem các ngày, cuộn dọc để xem nhân viên" tabIndex="0"><table className="erp-month-matrix-table" onMouseOver={handleMatrixMouseOver} onMouseLeave={clearMatrixTooltip} onFocusCapture={handleMatrixFocus} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) clearMatrixTooltip(event); }}><thead><tr><th className="erp-month-sticky-employee">Nhân viên</th><th className="erp-month-sticky-operation">CĐ</th>{axis.map((day) => { const isToday = day.isoDate === todayIso; const dayClass = `erp-month-day-head${day.isSunday ? " erp-month-sunday" : ""}${isToday ? " erp-month-today" : ""}`; return <th key={day.isoDate} className={dayClass} aria-current={isToday ? "date" : undefined}><button type="button" onClick={() => onDayHeaderClick?.(day)} data-date={day.isoDate} aria-label={`Nhập nhanh ngày ${day.weekdayLabel} ${day.displayDate}: chọn Mã SX và công đoạn`} title="Nhập nhanh sản lượng trong ngày"><span>{day.weekdayLabel}</span><strong>{day.displayDate}</strong><span className="erp-month-day-action"><Icon name="plus" size={12} /><span>Nhập</span></span></button></th>; })}<th className="erp-month-total erp-month-total-hc">Tổng HC</th><th className="erp-month-total erp-month-total-tc">Tổng TC</th><th className="erp-month-total erp-month-total-all">Tổng</th></tr></thead><tbody>
        {orders.flatMap((order) => {
          const rows = [];
          for (const employee of (order.employees ?? [])) {
            const inactive = employee.isActive === false;
            const workedDates = new Set(employee.workedDates ?? []);
            const paidLeaveDates = new Set(employee.paidLeaveDates ?? []);
            const enteredDates = new Set(employee.productionDates ?? []);
            const hourly = employee.compensationType === "Hourly";
            const isNewEmployee = isEmployeeNewInPeriod(employee.joinedDate, range.fromDate, range.untilDate);
            const employeeOperations = employee.operations?.length > 0
              ? employee.operations
              : [{ operationId: `empty-${employee.employeeId}`, operationNumber: "", operationName: "", hcQuantity: 0, tcQuantity: 0, totalQuantity: 0, cells: [] }];
            employeeOperations.forEach((operation, operationIndex) => {
              const map = cellsByDate(operation);
              rows.push(<tr key={`${order.orderId}-${employee.employeeId}-${operation.operationId}`} className={[inactive ? "erp-month-inactive" : "", isNewEmployee ? "erp-month-new-employee" : "", operationIndex === 0 ? "erp-month-group-start" : "", operationIndex === employeeOperations.length - 1 ? "erp-month-group-end" : ""].filter(Boolean).join(" ")}>
                {operationIndex === 0 && <td className={["erp-month-sticky-employee", "erp-month-employee", isNewEmployee ? "erp-month-new-employee" : ""].filter(Boolean).join(" ")} rowSpan={employeeOperations.length}><span className="erp-month-employee-name" title={employee.employeeName}>{employee.employeeName}</span>{inactive && <em>Đã tắt</em>}</td>}
                <td className="erp-month-sticky-operation erp-month-operation">{operation.operationNumber ? `CĐ${operation.operationNumber}` : ""}</td>
                {axis.flatMap((day) => {
                  const cell = map.get(day.isoDate) ?? null;
                  const futureDate = isFutureProductionDate(day.isoDate, todayIso);
                  const noAttendance = !inactive
                    && !futureDate
                    && !workedDates.has(day.isoDate)
                    && !paidLeaveDates.has(day.isoDate);
                  const missingOperation = !cell
                    && !futureDate
                    && !hourly
                    && workedDates.has(day.isoDate)
                    && !paidLeaveDates.has(day.isoDate)
                    && !enteredDates.has(day.isoDate);
                  const paidLeave = !inactive && paidLeaveDates.has(day.isoDate);
                  const futureBlank = futureDate && !cell && !paidLeave && !inactive;
                  const valueCellClass = ["erp-month-value-cell", futureBlank ? "erp-month-future" : "", noAttendance ? "erp-month-no-attendance" : paidLeave ? "erp-month-paid-leave" : missingOperation ? "erp-month-missing" : ""].filter(Boolean).join(" ");
                  const statusLabel = noAttendance ? " - chưa chấm công" : paidLeave ? " - nghỉ phép (P)" : missingOperation ? " - chưa nhập công đoạn" : "";
                  const cellLabel = statusLabel || (futureBlank ? " - chưa tới ngày" : "");
                  const statusMarkerClass = statusLabel ? `${valueCellClass} erp-month-status-marker` : valueCellClass;
                  const context = { cell, order, employee, operation, workDate: day.isoDate };
                  const actionDescription = cell ? "Bấm vào tổng để sửa HC/TC" : "Bấm vào tổng để nhập HC/TC";
                  const fullDate = day.isoDate.split("-").reverse().join("/");
                  const cellStatus = statusLabel ? statusLabel.slice(3) : futureBlank ? "Chưa tới ngày" : cell ? "Đã có sản lượng" : "Chưa có sản lượng";
                  const cellInfo = `Nhân viên: ${employee.employeeName}\nMã SX: ${order.orderCode ?? order.code ?? ""}\nCĐ${operation.operationNumber}${operation.operationName ? ` — ${operation.operationName}` : ""}\nNgày: ${day.weekdayLabel} ${fullDate}\nHC: ${quantity(cell?.hcQuantity)} · TC: ${quantity(cell?.tcQuantity)}\n${cellStatus}\n${actionDescription}`;
                  const total = cell ? cell.totalQuantity ?? Number(cell.hcQuantity ?? 0) + Number(cell.tcQuantity ?? 0) : null;
                  return <td key={day.isoDate} data-date={day.isoDate} className={statusMarkerClass}><button type="button" disabled={inactive} aria-disabled={inactive} onClick={() => { if (!inactive) onCellClick?.(context); }} aria-label={`${employee.employeeName} CĐ${operation.operationNumber} ${day.displayDate} Tổng${cellLabel}`} aria-description={cellInfo} title={cellInfo}>{cell ? quantity(total) : ""}{cell?.entryCount > 1 && <sup>{cell.entryCount}</sup>}</button></td>;
                })}
                <td className="erp-month-total erp-month-total-hc">{quantity(operation.hcQuantity)}</td><td className="erp-month-total erp-month-total-tc">{quantity(operation.tcQuantity)}</td><td className="erp-month-total erp-month-total-all"><strong>{quantity(operation.totalQuantity)}</strong></td>
              </tr>);
            });
          }
          return rows;
        })}
      </tbody></table></div>
        <div ref={hoverTooltipRef} className="erp-month-cell-tooltip" role="tooltip" aria-hidden="true" hidden />
      </>}
    </section>
  );
}
