import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { monthDateAxis, monthLabel } from "./productionMonthlyMatrix.js";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const quantity = (value) => numberFormat.format(Number(value ?? 0));
const cellsByDate = (operation) => new Map((operation.cells ?? []).map((cell) => [cell.workDate, cell]));

export function ProductionMonthlyMatrix({ data, monthKey, selectedOrderId = "", excludeSundays = true, loading = false, error = "", onSelectOrder, onToggleSundays, onCellClick, onDayHeaderClick, today = new Date() }) {
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const axis = useMemo(() => monthDateAxis(monthKey, excludeSundays), [monthKey, excludeSundays]);
  const scrollRef = useRef(null);
  const horizontalScrollRef = useRef(null);
  const horizontalScrollContentRef = useRef(null);
  const scrollLeftRef = useRef(0);
  const orders = data?.orders ?? [];
  const availableOrders = data?.availableOrders ?? [];
  const totalColumns = 2 + axis.length * 2 + 3;

  useEffect(() => {
    scrollLeftRef.current = 0;
  }, [monthKey, selectedOrderId]);

  useLayoutEffect(() => {
    if (!loading && !error && scrollRef.current) {
      if (horizontalScrollContentRef.current) {
        horizontalScrollContentRef.current.style.width = `${scrollRef.current.scrollWidth}px`;
      }
      const todayButton = monthKey === todayIso.slice(0, 7)
        ? scrollRef.current.querySelector(`[data-date="${todayIso}"]`)
        : null;
      const nextScrollLeft = todayButton
        ? Math.max(0, todayButton.offsetLeft - 220)
        : scrollLeftRef.current;
      if (!todayButton) {
        scrollRef.current.scrollLeft = scrollLeftRef.current;
        if (horizontalScrollRef.current) horizontalScrollRef.current.scrollLeft = scrollLeftRef.current;
        return;
      }
      scrollRef.current.scrollLeft = nextScrollLeft;
      if (horizontalScrollRef.current) horizontalScrollRef.current.scrollLeft = nextScrollLeft;
      scrollLeftRef.current = nextScrollLeft;
    }
  }, [loading, error, monthKey, selectedOrderId, excludeSundays, todayIso]);

  return (
    <section className="erp-month-matrix-section" aria-label={`Sản lượng ${monthLabel(monthKey)}`}>
      <div className="erp-month-matrix-toolbar">
        <div className="erp-month-order-filter" role="group" aria-label="Lọc Mã SX">
          {availableOrders.length === 0 ? <strong>{monthLabel(monthKey)}</strong> : <><button type="button" className="erp-button erp-button-secondary erp-month-order-filter-button" aria-pressed={!selectedOrderId} onClick={() => onSelectOrder?.("")}>Tất cả mã SX</button>{availableOrders.map((order) => <button key={order.id} type="button" className="erp-button erp-button-secondary erp-month-order-filter-button" aria-pressed={selectedOrderId === order.id} onClick={() => onSelectOrder?.(order.id)}>{order.code}</button>)}</>}
        </div>
        <label className="erp-month-sunday-toggle"><input type="checkbox" checked={excludeSundays} onChange={(event) => onToggleSundays?.(event.target.checked)} /><span>Ẩn Chủ nhật</span></label>
      </div>
      {error && <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>}
      {loading && <div className="erp-table-state">Đang tải sản lượng tháng...</div>}
      {!loading && !error && <>
        <div ref={horizontalScrollRef} className="erp-month-matrix-horizontal-scroll" aria-label="Cuộn ngang ma trận" role="region" tabIndex="0" onScroll={(event) => { const nextScrollLeft = event.currentTarget.scrollLeft; scrollLeftRef.current = nextScrollLeft; if (scrollRef.current && scrollRef.current.scrollLeft !== nextScrollLeft) scrollRef.current.scrollLeft = nextScrollLeft; }}><div ref={horizontalScrollContentRef} aria-hidden="true" /></div>
        <div ref={scrollRef} onScroll={(event) => { const nextScrollLeft = event.currentTarget.scrollLeft; scrollLeftRef.current = nextScrollLeft; if (horizontalScrollRef.current && horizontalScrollRef.current.scrollLeft !== nextScrollLeft) horizontalScrollRef.current.scrollLeft = nextScrollLeft; }} className="erp-month-matrix-scroll"><table className="erp-month-matrix-table"><thead><tr><th className="erp-month-sticky-employee" rowSpan="2">Nhân viên</th><th className="erp-month-sticky-operation" rowSpan="2">CĐ</th>{axis.map((day) => { const isToday = day.isoDate === todayIso; return <th key={day.isoDate} className={`erp-month-day-head${isToday ? " erp-month-today" : ""}`} colSpan="2" aria-current={isToday ? "date" : undefined}><button type="button" onClick={() => onDayHeaderClick?.(day)} data-date={day.isoDate} aria-label={`Nhập nhanh ngày ${day.weekdayLabel} ${day.displayDate}: chọn Mã SX và công đoạn`} title="Chọn Mã SX và công đoạn để nhập nhanh"><span>{day.weekdayLabel}</span><strong>{day.displayDate}</strong></button></th>; })}<th className="erp-month-total erp-month-total-hc" rowSpan="2">Tổng HC</th><th className="erp-month-total erp-month-total-tc" rowSpan="2">Tổng TC</th><th className="erp-month-total erp-month-total-all" rowSpan="2">Tổng</th></tr><tr>{axis.flatMap((day) => [<th key={`${day.isoDate}-hc`} className="erp-month-day-sub">HC</th>, <th key={`${day.isoDate}-tc`} className="erp-month-day-sub">TC</th>])}</tr></thead><tbody>
        {orders.length === 0 && <tr><td colSpan={totalColumns} className="erp-table-state">Chưa có sản lượng. Bấm vào ngày phía trên để nhập nhanh nhiều công đoạn.</td></tr>}
        {orders.flatMap((order) => {
          const rows = [<tr className="erp-month-order-row" key={`order-${order.orderId}`}><th colSpan={totalColumns}><strong>Mã SX: {order.orderCode}</strong><span>{order.productName}</span></th></tr>];
          for (const employee of order.employees ?? []) {
            (employee.operations ?? []).forEach((operation, operationIndex) => {
              const map = cellsByDate(operation);
              rows.push(<tr key={`${order.orderId}-${employee.employeeId}-${operation.operationId}`}>
                {operationIndex === 0 && <td className="erp-month-sticky-employee erp-month-employee" rowSpan={employee.operations.length}>{employee.employeeName}</td>}
                <td className="erp-month-sticky-operation erp-month-operation">CĐ{operation.operationNumber}</td>
                {axis.flatMap((day) => {
                  const cell = map.get(day.isoDate) ?? null;
                  const context = { cell, order, employee, operation, workDate: day.isoDate };
                  return [<td key={`${day.isoDate}-hc`} className="erp-month-value-cell"><button type="button" onClick={() => onCellClick?.(context)} aria-label={`${employee.employeeName} CĐ${operation.operationNumber} ${day.displayDate} HC`}>{cell ? quantity(cell.hcQuantity) : ""}</button></td>, <td key={`${day.isoDate}-tc`} className="erp-month-value-cell"><button type="button" onClick={() => onCellClick?.(context)} aria-label={`${employee.employeeName} CĐ${operation.operationNumber} ${day.displayDate} TC`}>{cell ? quantity(cell.tcQuantity) : ""}{cell?.entryCount > 1 && <sup>{cell.entryCount}</sup>}</button></td>];
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
