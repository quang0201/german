import React, { useMemo } from "react";
import { monthDateAxis, monthLabel } from "./productionMonthlyMatrix.js";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const quantity = (value) => numberFormat.format(Number(value ?? 0));
const cellsByDate = (operation) => new Map((operation.cells ?? []).map((cell) => [cell.workDate, cell]));

export function ProductionMonthlyMatrix({ data, monthKey, selectedOrderId = "", excludeSundays = true, loading = false, error = "", onSelectOrder, onToggleSundays, onCellClick, onDayHeaderClick }) {
  const axis = useMemo(() => monthDateAxis(monthKey, excludeSundays), [monthKey, excludeSundays]);
  const orders = data?.orders ?? [];
  const availableOrders = data?.availableOrders ?? [];
  const totalColumns = 2 + axis.length * 2 + 3;
  return (
    <section className="erp-month-matrix-section" aria-label={`Sản lượng ${monthLabel(monthKey)}`}>
      <div className="erp-month-matrix-toolbar">
        <div className="erp-month-order-filter" role="group" aria-label="Lọc Mã SX">
          {availableOrders.length <= 1 ? <strong>{availableOrders[0] ? `${monthLabel(monthKey)} · Mã SX: ${availableOrders[0].code}` : monthLabel(monthKey)}</strong> : <><button type="button" className="erp-button erp-button-secondary" aria-pressed={!selectedOrderId} onClick={() => onSelectOrder?.("")}>Tất cả mã SX</button>{availableOrders.map((order) => <button key={order.id} type="button" className="erp-button erp-button-secondary" aria-pressed={selectedOrderId === order.id} onClick={() => onSelectOrder?.(order.id)}>{order.code}</button>)}</>}
        </div>
        <label className="erp-month-sunday-toggle"><input type="checkbox" checked={excludeSundays} onChange={(event) => onToggleSundays?.(event.target.checked)} /><span>Ẩn Chủ nhật</span></label>
      </div>
      {error && <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>}
      {loading && <div className="erp-table-state">Đang tải sản lượng tháng...</div>}
      {!loading && !error && <div className="erp-month-matrix-scroll"><table className="erp-month-matrix-table"><thead><tr><th className="erp-month-sticky-employee" rowSpan="2">Nhân viên</th><th className="erp-month-sticky-operation" rowSpan="2">CĐ</th>{axis.map((day) => <th key={day.isoDate} className="erp-month-day-head" colSpan="2"><button type="button" onClick={() => onDayHeaderClick?.(day)} data-date={day.isoDate}><span>{day.weekdayLabel}</span><strong>{day.displayDate}</strong></button></th>)}<th className="erp-month-total erp-month-total-hc" rowSpan="2">Tổng HC</th><th className="erp-month-total erp-month-total-tc" rowSpan="2">Tổng TC</th><th className="erp-month-total erp-month-total-all" rowSpan="2">Tổng</th></tr><tr>{axis.flatMap((day) => [<th key={`${day.isoDate}-hc`} className="erp-month-day-sub">HC</th>, <th key={`${day.isoDate}-tc`} className="erp-month-day-sub">TC</th>])}</tr></thead><tbody>
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
      </tbody></table></div>}
    </section>
  );
}
