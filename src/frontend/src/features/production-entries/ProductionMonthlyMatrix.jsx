import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Icon } from "../../components/erp/Icon.jsx";
import { dateRangeAxis, isEmployeeNewInPeriod, isFutureProductionDate, mergeHourlyEmployeesIntoOrders, monthBounds, monthDateAxis, monthLabel } from "./productionMonthlyMatrix.js";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const quantity = (value) => numberFormat.format(Number(value ?? 0));
const cellsByDate = (operation) => new Map((operation.cells ?? []).map((cell) => [cell.workDate, cell]));

export function ProductionMonthlyMatrix({ data, monthKey, fromDate = "", untilDate = "", selectedOrderId = "", excludeSundays = true, showSundayToggle = true, showOrderFilter = true, loading = false, error = "", onSelectOrder, onToggleSundays, onCellClick, onDayHeaderClick, today = new Date() }) {
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const range = useMemo(() => fromDate && untilDate ? { fromDate, untilDate } : monthBounds(monthKey), [fromDate, untilDate, monthKey]);
  const axis = useMemo(() => fromDate && untilDate ? dateRangeAxis(fromDate, untilDate, excludeSundays) : monthDateAxis(monthKey, excludeSundays), [fromDate, untilDate, monthKey, excludeSundays]);
  const rangeLabel = fromDate && untilDate ? `${range.fromDate.split("-").reverse().join("/")} – ${range.untilDate.split("-").reverse().join("/")}` : monthLabel(monthKey);
  const scrollRef = useRef(null);
  const scrollLeftRef = useRef(0);
  const availableOrders = data?.availableOrders ?? [];
  const hourlyEmployees = data?.hourlyEmployees ?? [];
  const orders = useMemo(() => mergeHourlyEmployeesIntoOrders(data?.orders ?? [], hourlyEmployees), [data?.orders, hourlyEmployees]);

  useEffect(() => {
    scrollLeftRef.current = 0;
  }, [monthKey, selectedOrderId]);

  useLayoutEffect(() => {
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
  }, [loading, error, monthKey, fromDate, untilDate, selectedOrderId, excludeSundays, todayIso, range.fromDate, range.untilDate]);

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
      <div className="erp-month-matrix-help"><Icon name="info" size={15} /><span>Chọn ngày để nhập nhanh nhiều người · Chọn ô HC/TC để nhập hoặc sửa từng người</span></div>
      {orders.length === 0 && !loading && !error && <div className="erp-month-empty-state">Chưa có sản lượng. Bấm vào ngày phía trên để nhập nhanh nhiều công đoạn.</div>}
      {loading && <div className="erp-table-state">Đang tải sản lượng...</div>}
      {!loading && !error && <>
        <div className="erp-month-matrix-scroll-hint" aria-hidden="true">Cuộn ngang để xem các ngày khác <span>→</span></div>
        <div ref={scrollRef} onScroll={(event) => { scrollLeftRef.current = event.currentTarget.scrollLeft; }} className="erp-month-matrix-scroll" role="region" aria-label="Ma trận sản lượng; cuộn ngang để xem các ngày, cuộn dọc để xem nhân viên" tabIndex="0"><table className="erp-month-matrix-table"><thead><tr><th className="erp-month-sticky-employee" rowSpan="2">Nhân viên</th><th className="erp-month-sticky-operation" rowSpan="2">CĐ</th>{axis.map((day) => { const isToday = day.isoDate === todayIso; const dayClass = `erp-month-day-head${day.isSunday ? " erp-month-sunday" : ""}${isToday ? " erp-month-today" : ""}`; return <th key={day.isoDate} className={dayClass} colSpan="2" aria-current={isToday ? "date" : undefined}><button type="button" onClick={() => onDayHeaderClick?.(day)} data-date={day.isoDate} aria-label={`Nhập nhanh ngày ${day.weekdayLabel} ${day.displayDate}: chọn Mã SX và công đoạn`} title="Nhập nhanh sản lượng trong ngày"><span>{day.weekdayLabel}</span><strong>{day.displayDate}</strong><span className="erp-month-day-action"><Icon name="plus" size={12} /><span>Nhập</span></span></button></th>; })}<th className="erp-month-total erp-month-total-hc" rowSpan="2">Tổng HC</th><th className="erp-month-total erp-month-total-tc" rowSpan="2">Tổng TC</th><th className="erp-month-total erp-month-total-all" rowSpan="2">Tổng</th></tr><tr>{axis.flatMap((day) => [<th key={`${day.isoDate}-hc`} className="erp-month-day-sub">HC</th>, <th key={`${day.isoDate}-tc`} className="erp-month-day-sub">TC</th>])}</tr></thead><tbody>
        {orders.flatMap((order) => {
          const rows = [];
          for (const [employeeIndex, employee] of (order.employees ?? []).entries()) {
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
              rows.push(<tr key={`${order.orderId}-${employee.employeeId}-${operation.operationId}`} className={[inactive ? "erp-month-inactive" : "", isNewEmployee ? "erp-month-new-employee" : "", employeeIndex % 2 ? "erp-month-group-alt" : "", operationIndex === 0 ? "erp-month-group-start" : ""].filter(Boolean).join(" ")}>
                {operationIndex === 0 && <td className={["erp-month-sticky-employee", "erp-month-employee", isNewEmployee ? "erp-month-new-employee" : ""].filter(Boolean).join(" ")} rowSpan={employeeOperations.length}>{employee.employeeName}{inactive && <em>Đã tắt</em>}</td>}
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
                  const actionDescription = cell ? "Bấm để sửa sản lượng" : "Bấm để nhập sản lượng";
                  return [<td key={`${day.isoDate}-hc`} data-date={day.isoDate} className={statusMarkerClass}><button type="button" disabled={inactive} aria-disabled={inactive} onClick={() => { if (!inactive) onCellClick?.(context); }} aria-label={`${employee.employeeName} CĐ${operation.operationNumber} ${day.displayDate} HC${cellLabel}`} title={statusLabel ? `${statusLabel.slice(3)} · ${actionDescription}` : actionDescription}>{cell ? quantity(cell.hcQuantity) : ""}</button></td>, <td key={`${day.isoDate}-tc`} data-date={day.isoDate} className={valueCellClass}><button type="button" disabled={inactive} aria-disabled={inactive} onClick={() => { if (!inactive) onCellClick?.(context); }} aria-label={`${employee.employeeName} CĐ${operation.operationNumber} ${day.displayDate} TC${cellLabel}`} title={statusLabel ? `${statusLabel.slice(3)} · ${actionDescription}` : actionDescription}>{cell ? quantity(cell.tcQuantity) : ""}{cell?.entryCount > 1 && <sup>{cell.entryCount}</sup>}</button></td>];
                })}
                <td className="erp-month-total erp-month-total-hc">{quantity(operation.hcQuantity)}</td><td className="erp-month-total erp-month-total-tc">{quantity(operation.tcQuantity)}</td><td className="erp-month-total erp-month-total-all"><strong>{quantity(operation.totalQuantity)}</strong></td>
              </tr>);
            });
          }
          return rows;
        })}
      </tbody></table></div>
      </>}
    </section>
  );
}
