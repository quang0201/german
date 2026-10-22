import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { dateRangeAxis } from "./productionMonthlyMatrix.js";
import { buildDailyProduction } from "./productionDailyModel.js";
import { formatDisplayDate } from "./productionPeriod.js";
import "./ProductionDailyView.css";

const n = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
const statuses = {
  complete: ["Đã lưu SL + công", "success"],
  "missing-attendance": ["Có SL · thiếu công", "warning"],
  "missing-production": ["Có công · thiếu SL", "warning"],
  empty: ["Chưa nhập", "muted"],
  leave: ["Đã ghi nghỉ", "muted"],
  hourly: ["Đã lưu công · theo giờ", "success"],
};

export function ProductionDailyView({ data, date, employees = [], filters = {}, selectedOrderId, loading, error, reloadKey, onCellClick, onEmployeeClick }) {
  const [attendance, setAttendance] = useState([]);
  const [attendanceState, setAttendanceState] = useState("loading");
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setAttendance([]); setAttendanceState("loading");
    async function load() {
      const [year, month, day] = date.split("-").map(Number);
      let cursor = "", result = [];
      do {
        const params = new URLSearchParams({ year, month, dayFrom: day, dayCount: 1, employeeLimit: 100 });
        if (cursor) params.set("employeeCursor", cursor);
        const payload = await api.get(`/api/attendance/monthly?${params}`);
        if (!active) return;
        result.push(...payload.employees);
        const next = payload.hasMoreEmployees ? payload.nextEmployeeCursor : "";
        if (next && next === cursor) throw new Error("Cursor chấm công không thay đổi.");
        cursor = next;
      } while (cursor);
      if (active) { setAttendance(result); setAttendanceState("ready"); }
    }
    load().catch(() => { if (active) setAttendanceState("error"); });
    return () => { active = false; };
  }, [date, reloadKey, retry]);

  const groups = useMemo(() => {
    const roster = employees.filter((employee) => (!filters.employeeId || String(employee.id) === String(filters.employeeId))
      && (!filters.search || `${employee.fullName} ${employee.employeeCode}`.toLocaleLowerCase("vi").includes(filters.search.toLocaleLowerCase("vi"))));
    // Order/operation/search filters already scope matrix rows; avoid introducing unrelated empty people.
    return buildDailyProduction(data, date, attendance, selectedOrderId || filters.operationId || filters.search ? [] : roster);
  }, [data, date, attendance, employees, filters, selectedOrderId]);
  const visible = groups.filter((group) => (showAll || group.status !== "empty") && (statusFilter === "all" || (statusFilter === "attention" ? group.status.startsWith("missing-") : ["complete", "hourly"].includes(group.status))));
  const complete = groups.filter((group) => ["complete", "hourly"].includes(group.status)).length;
  const missing = groups.filter((group) => group.status.startsWith("missing-")).length;
  const day = dateRangeAxis(date, date)[0];
  if (loading) return <p className="erp-table-state" role="status">Đang tải sản lượng ngày...</p>;
  if (error) return <p className="erp-inline-message erp-inline-error" role="alert">{error}</p>;
  const attendanceReady = attendanceState === "ready";
  return <section className="erp-daily" aria-label={`Sản lượng ngày ${formatDisplayDate(date)}`}>
    <div className="erp-daily-overview">
      <div><h2>Nhật ký ngày {formatDisplayDate(date)}</h2><p>Đối chiếu sản lượng và chấm công theo từng người. Giờ công tính một lần trong ngày.</p></div>
      <button type="button" className="erp-button erp-button-primary" onClick={() => onEmployeeClick(null, day)}>Nhập ngày này</button>
    </div>
    {attendanceState === "error" && <div className="erp-inline-message erp-inline-error" role="alert">Chưa tải được chấm công; chưa thể kết luận đã lưu đủ. <button type="button" className="erp-button erp-button-link" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>}
    <div className="erp-daily-toolbar">
      <div className="erp-daily-counts" role="status">{attendanceReady ? <><strong>{complete} người đủ SL/công</strong><span>{missing} người cần kiểm tra</span></> : <span>{attendanceState === "error" ? "Chấm công chưa xác định" : "Đang đối chiếu chấm công…"}</span>}</div>
      <label>Hiển thị <select className="erp-control" aria-label="Trạng thái dữ liệu ngày" value={statusFilter} disabled={!attendanceReady} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="attention">Cần kiểm tra</option><option value="complete">Đã lưu SL/công</option></select></label>
      <label className="erp-daily-checkbox"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />Hiện cả người chưa nhập</label>
    </div>
    {!visible.length && <div className="erp-week-empty">Không có dữ liệu phù hợp trong ngày. Chọn “Hiện cả người chưa nhập” hoặc “Nhập ngày này” để bắt đầu.</div>}
    {visible.map((group) => {
      const [label, tone] = attendanceReady ? statuses[group.status] : ["Chưa đối chiếu công", "muted"];
      const readOnly = group.isActive === false && (!group.deactivatedAt || date >= group.deactivatedAt);
      return <article className="erp-daily-person" key={group.employeeId}>
        <header><div><h3>{group.employeeName}</h3><span className="erp-daily-code">{group.employeeCode}</span></div><span className={`erp-daily-status is-${tone}`}>{label}</span>
          <div className="erp-daily-hours">{attendanceReady && group.hasAttendance ? <><span>HC <strong>{n(group.hcHours)} giờ</strong></span><span>TC <strong>{n(group.tcHours)} giờ</strong></span></> : <span>{attendanceReady ? "Chưa có chấm công" : "Chấm công chưa xác định"}</span>}</div>
          <button type="button" className="erp-button erp-button-secondary erp-button-small" disabled={readOnly} onClick={() => onEmployeeClick(group, day)}>Nhập SL / công</button>
        </header>
        {group.lines.length ? <div className="erp-daily-table-wrap" role="region" aria-label={`Sản lượng ${group.employeeName}`} tabIndex={0}><table>
          <thead><tr><th scope="col">Mã sản xuất · Màu · Tháng</th><th scope="col">Công đoạn</th><th scope="col">Tổng</th><th scope="col">HC</th><th scope="col">TC</th><th scope="col">ĐVT</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{group.lines.map((line) => <tr key={`${line.order.orderId}-${line.operation.operationId}`}>
            <td><strong>{line.order.orderCode}</strong><small>{line.order.productName}</small></td><td><strong>CĐ{line.operation.operationNumber}</strong><small>{line.operation.operationName}</small></td>
            <td className="is-total" data-label="Tổng">{n(line.total)}</td><td data-label="HC">{n(line.hc)}</td><td className="is-overtime" data-label="TC">{n(line.tc)}</td><td data-label="ĐVT">{line.operation.unit}</td>
            <td><button type="button" className="erp-button erp-button-link" disabled={readOnly} aria-label={`Sửa ${group.employeeName} ${line.order.orderCode} CĐ${line.operation.operationNumber}`} onClick={() => onCellClick({ ...line, workDate: date })}>Sửa</button></td>
          </tr>)}</tbody>
        </table></div> : <p className="erp-daily-no-output">{group.status === "hourly" ? "Tính tiền theo giờ; không yêu cầu sản lượng." : group.status === "leave" ? "Đã ghi nghỉ trong ngày." : "Chưa nhập công đoạn nào trong ngày này."}</p>}
      </article>;
    })}
    <p className="erp-daily-note">“Đã lưu SL + công” xác nhận có dữ liệu ở cả hai phần, không có nghĩa là đã duyệt lương. Các công đoạn được đếm riêng, không cộng thành số thành phẩm.</p>
  </section>;
}
