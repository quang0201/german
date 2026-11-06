import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Icon } from "../../components/erp/Icon.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { queryMonth, readQuery, useQuerySync } from "../../lib/queryState.js";
import { ProductionMonthNavigator } from "../production-entries/ProductionMonthNavigator.jsx";
import { buildProductionMonthlyMatrixUrl, shiftMonth } from "../production-entries/productionMonthlyMatrix.js";
import { currentReportMonthKey } from "./productionMonthlyReport.js";
import { buildEmployeeMonthlyTotals, dayLabel, filterEmployeeTotals, formatQuantity } from "./employeeMonthlyTotals.js";
import "./EmployeeMonthlyReport.css";

const emptyTotals = { employees: [], summary: { employeeCount: 0, hc: 0, tc: 0, total: 0 } };

function Bar({ value, max }) {
  const percent = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <span className="erp-emp-bar" aria-hidden="true"><span style={{ width: `${value > 0 ? percent : 0}%` }} /></span>;
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="erp-emp-summary-card">
      <span>{label}</span>
      <strong>{formatQuantity(value)}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function ToggleButton({ open, onClick, children, className = "" }) {
  return (
    <button type="button" className={`erp-emp-toggle ${className}`} aria-expanded={open} onClick={onClick}>
      <span className={`erp-emp-chevron${open ? " is-open" : ""}`} aria-hidden="true"><Icon name="chevronRight" size={16} /></span>
      {children}
    </button>
  );
}

export function EmployeeMonthlyReportPage() {
  const fallbackMonth = currentReportMonthKey();
  const [initialQuery] = useState(() => readQuery(["month", "q"]));
  const [monthKey, setMonthKey] = useState(() => queryMonth(initialQuery.month, fallbackMonth));
  const [search, setSearch] = useState(initialQuery.q);
  const [totals, setTotals] = useState(emptyTotals);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openEmployees, setOpenEmployees] = useState(() => new Set());
  const [openOperations, setOpenOperations] = useState(() => new Set());
  useQuerySync({ month: monthKey, q: search }, { month: fallbackMonth, q: "" });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get(buildProductionMonthlyMatrixUrl({ monthKey, excludeSundays: false }))
      .then((matrix) => {
        if (!active) return;
        setTotals(buildEmployeeMonthlyTotals(matrix));
        setOpenEmployees(new Set());
        setOpenOperations(new Set());
      })
      .catch((requestError) => {
        if (!active) return;
        setTotals(emptyTotals);
        setError(requestError.message || "Không thể tải sản lượng theo người.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [monthKey]);

  const visible = useMemo(() => filterEmployeeTotals(totals.employees, search), [totals.employees, search]);
  const maxEmployeeTotal = visible.reduce((max, item) => Math.max(max, item.total), 0);

  function toggle(setter, key) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setOpenEmployees(new Set(visible.map((item) => item.employeeId)));
  }

  function collapseAll() {
    setOpenEmployees(new Set());
    setOpenOperations(new Set());
  }

  const rows = [];
  for (const employee of visible) {
    const employeeOpen = openEmployees.has(employee.employeeId);
    rows.push(
      <tr key={employee.employeeId} className={`erp-emp-row-person${employeeOpen ? " is-open" : ""}`}>
        <td>
          <ToggleButton open={employeeOpen} onClick={() => toggle(setOpenEmployees, employee.employeeId)}>
            <span className="erp-emp-name">{employee.name}</span>
            <span className="erp-emp-meta">{employee.code}{employee.isActive ? "" : " · đã nghỉ"} · {employee.orders.length} mã</span>
          </ToggleButton>
        </td>
        <td className="erp-report-number">{formatQuantity(employee.hc)}</td>
        <td className="erp-report-number">{formatQuantity(employee.tc)}</td>
        <td className="erp-report-number erp-emp-total">{formatQuantity(employee.total)}</td>
        <td className="erp-emp-bar-cell"><Bar value={employee.total} max={maxEmployeeTotal} /></td>
      </tr>
    );
    if (!employeeOpen) continue;

    for (const order of employee.orders) {
      rows.push(
        <tr key={`${employee.employeeId}-${order.orderId}`} className="erp-emp-row-order">
          <td><span className="erp-emp-order-code">{order.orderCode}</span></td>
          <td className="erp-report-number">{formatQuantity(order.hc)}</td>
          <td className="erp-report-number">{formatQuantity(order.tc)}</td>
          <td className="erp-report-number erp-emp-total">{formatQuantity(order.total)}</td>
          <td className="erp-emp-bar-cell"><Bar value={order.total} max={employee.total} /></td>
        </tr>
      );
      for (const operation of order.operations) {
        const key = `${employee.employeeId}|${order.orderId}|${operation.operationId}`;
        const operationOpen = openOperations.has(key);
        rows.push(
          <tr key={key} className={`erp-emp-row-operation${operationOpen ? " is-open" : ""}`}>
            <td>
              <ToggleButton open={operationOpen} onClick={() => toggle(setOpenOperations, key)} className="erp-emp-toggle-operation">
                <span className="erp-emp-operation-number">CĐ{operation.number}</span>
                <span className="erp-emp-operation-name">{operation.name}</span>
                <span className="erp-emp-meta">{operation.days.length} ngày</span>
              </ToggleButton>
            </td>
            <td className="erp-report-number">{formatQuantity(operation.hc)}</td>
            <td className="erp-report-number">{formatQuantity(operation.tc)}</td>
            <td className="erp-report-number erp-emp-total">{formatQuantity(operation.total)}</td>
            <td className="erp-emp-bar-cell"><Bar value={operation.total} max={order.total} /></td>
          </tr>
        );
        if (!operationOpen) continue;
        const maxDay = operation.days.reduce((max, day) => Math.max(max, day.total), 0);
        for (const day of operation.days) {
          const label = dayLabel(day.date);
          rows.push(
            <tr key={`${key}|${day.date}`} className={`erp-emp-row-day${label.isSunday ? " is-sunday" : ""}`}>
              <td><span className="erp-emp-day"><b>{label.weekday}</b> {label.display}</span></td>
              <td className="erp-report-number">{formatQuantity(day.hc)}</td>
              <td className="erp-report-number">{formatQuantity(day.tc)}</td>
              <td className="erp-report-number erp-emp-total">{formatQuantity(day.total)}</td>
              <td className="erp-emp-bar-cell"><Bar value={day.total} max={maxDay} /></td>
            </tr>
          );
        }
      }
    }
  }

  return (
    <div className="erp-emp-report">
      <PageHeader
        title="Tổng theo người"
        description="Xem mỗi người làm bao nhiêu trong tháng. Bấm tên người để xem theo mã, bấm công đoạn để xem từng ngày."
      />
      <div className="erp-emp-toolbar">
        <ProductionMonthNavigator monthKey={monthKey} onPrevious={() => setMonthKey(shiftMonth(monthKey, -1))} onNext={() => setMonthKey(shiftMonth(monthKey, 1))} />
        <label className="erp-emp-search">
          <Icon name="search" size={16} />
          <input className="erp-control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc mã nhân viên" aria-label="Tìm nhân viên" />
        </label>
        <div className="erp-emp-toolbar-actions">
          <button type="button" className="erp-button erp-button-secondary" onClick={expandAll} disabled={visible.length === 0}>Mở tất cả</button>
          <button type="button" className="erp-button erp-button-secondary" onClick={collapseAll} disabled={openEmployees.size === 0}>Thu gọn</button>
        </div>
      </div>
      {error && <Alert variant="error" title="Không thể tải sản lượng theo người.">{error}</Alert>}
      <div className="erp-emp-summary" aria-label="Tổng kết tháng">
        <SummaryCard label="Số người có sản lượng" value={totals.summary.employeeCount} />
        <SummaryCard label="Tổng HC" value={totals.summary.hc} />
        <SummaryCard label="Tổng TC" value={totals.summary.tc} />
        <SummaryCard label="Tổng sản lượng" value={totals.summary.total} hint="cộng tất cả công đoạn" />
      </div>
      {loading && <div className="erp-report-state">Đang tải sản lượng theo người...</div>}
      {!loading && !error && totals.employees.length === 0 && <div className="erp-report-state">Tháng này chưa có sản lượng.</div>}
      {!loading && !error && totals.employees.length > 0 && visible.length === 0 && <div className="erp-report-state">Không có người nào khớp "{search}".</div>}
      {!loading && visible.length > 0 && (
        <div className="erp-emp-table-wrap">
          <table className="erp-emp-table">
            <thead>
              <tr>
                <th>Người / Mã / Công đoạn / Ngày</th>
                <th className="erp-report-number">HC</th>
                <th className="erp-report-number">TC</th>
                <th className="erp-report-number">Tổng</th>
                <th className="erp-emp-bar-head" aria-label="Tỷ lệ" />
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
