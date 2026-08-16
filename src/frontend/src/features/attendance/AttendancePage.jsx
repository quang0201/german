import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { AttendanceMonthlyMatrix } from "./AttendanceMonthlyMatrix.jsx";
import { attendanceDayKey, buildAttendanceDrafts, buildAttendanceSavePayload, currentAttendanceMonth, shiftAttendanceMonth } from "./attendanceModel.js";
import "./AttendanceMonthlyMatrix.css";

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

export function AttendancePage() {
  const [monthKey, setMonthKey] = useState(() => currentAttendanceMonth());
  const [data, setData] = useState({ employees: [] });
  const [drafts, setDrafts] = useState({});
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const [year, month] = monthKey.split("-");
    api.get(`/api/attendance/monthly?year=${year}&month=${month}`)
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setDrafts(buildAttendanceDrafts(payload));
        setDirty(false);
      })
      .catch((requestError) => { if (active) setError(requestError.message || "Không thể tải dữ liệu chấm công."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [monthKey]);

  const visibleData = useMemo(() => ({
    ...data,
    employees: employeeId ? (data.employees ?? []).filter((employee) => employee.employeeId === employeeId) : data.employees,
  }), [data, employeeId]);

  function ensureDraft(employee, day) {
    const key = attendanceDayKey(employee.employeeId, day.workDate);
    return drafts[key] ?? {
      overtimeHours: day.overtimeHours ? String(day.overtimeHours) : "",
      shifts: Object.fromEntries((day.shifts ?? []).map((shift) => [shift.slotNumber, ""])),
    };
  }

  function handleCellChange(employee, day, shift, value) {
    if (!shift) return;
    const key = attendanceDayKey(employee.employeeId, day.workDate);
    const current = ensureDraft(employee, day);
    setDrafts((previous) => ({ ...previous, [key]: { ...current, shifts: { ...current.shifts, [shift.slotNumber]: value } } }));
    setDirty(true);
    setError("");
  }

  function handleOvertimeChange(employee, day, value) {
    const key = attendanceDayKey(employee.employeeId, day.workDate);
    const current = ensureDraft(employee, day);
    setDrafts((previous) => ({ ...previous, [key]: { ...current, overtimeHours: value } }));
    setDirty(true);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const [year, month] = monthKey.split("-").map(Number);
      const payload = buildAttendanceSavePayload(data, drafts, year, month);
      const result = await api.put("/api/attendance/monthly", payload);
      setData(result);
      setDrafts(buildAttendanceDrafts(result));
      setDirty(false);
    } catch (requestError) {
      setError(requestError.message || "Không thể lưu chấm công.");
    } finally {
      setSaving(false);
    }
  }

  const [year, month] = monthKey.split("-").map(Number);
  const totalEmployees = data.employees?.length ?? 0;

  return (
    <div className="erp-feature-page erp-attendance-page">
      <PageHeader
        title="Chấm công"
        description="Nhập giờ HC theo ca, nghỉ P/Ô và giờ TC theo ngày."
        actions={<div className="erp-attendance-actions"><span className="erp-attendance-dirty">{dirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ"}</span><button type="button" className="erp-button erp-button-primary" onClick={save} disabled={saving || !dirty}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button></div>}
      />
      {error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}
      <div className="erp-attendance-toolbar">
        <div className="erp-attendance-month" aria-label="Chọn tháng">
          <button type="button" className="erp-button erp-button-secondary" onClick={() => setMonthKey((value) => shiftAttendanceMonth(value, -1))}>←</button>
          <strong>{monthLabel(monthKey)}</strong>
          <button type="button" className="erp-button erp-button-secondary" onClick={() => setMonthKey((value) => shiftAttendanceMonth(value, 1))}>→</button>
        </div>
        <div className="erp-attendance-summary"><span>Nhân viên: <strong>{totalEmployees}</strong></span><span>Quy ước: <strong>giờ HC · P · Ô · TC</strong></span></div>
      </div>
      <div className="erp-attendance-filters">
        <label className="erp-field erp-attendance-filter-field"><span className="erp-field-label">Nhân viên</span><select className="erp-control" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Tất cả nhân viên</option>{(data.employees ?? []).map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeCode} — {employee.fullName}</option>)}</select></label>
        <span className="erp-field-hint">Ô trống = chưa nhập · nhập P/Ô cho nghỉ · TC nhập một lần theo ngày</span>
      </div>
      <AttendanceMonthlyMatrix data={visibleData} drafts={drafts} onCellChange={handleCellChange} onOvertimeChange={handleOvertimeChange} loading={loading} scrollLeft={scrollLeft} onScrollPositionChange={setScrollLeft} />
    </div>
  );
}
