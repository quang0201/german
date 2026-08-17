import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { mapProductionEntryError } from "../production-entries/productionEntryErrors.js";
import { EmployeeDialog } from "./EmployeeDialog.jsx";

export function EmployeeListPage() {
  const [rows, setRows] = useState([]);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  function loadEmployees() { setLoading(true); api.get("/api/employees").then(setRows).catch((e) => setError(mapProductionEntryError(e, "Không thể tải nhân viên."))).finally(() => setLoading(false)); }
  function loadShiftTemplates() { setShiftLoading(true); api.get("/api/shift-templates").then((items) => { setShiftTemplates(items); setShiftError(""); }).catch((e) => setShiftError(mapProductionEntryError(e, "Không thể tải bộ ca."))).finally(() => setShiftLoading(false)); }
  useEffect(() => { loadEmployees(); loadShiftTemplates(); }, []);
  async function submitCreate(payload) { setCreateSaving(true); setCreateError(""); try { await api.post("/api/employees", payload); setCreateOpen(false); loadEmployees(); } catch (e) { setCreateError(mapProductionEntryError(e, "Không thể tạo nhân viên và gán bộ ca.")); } finally { setCreateSaving(false); } }
  async function submitEdit(payload) { if (!editingEmployee) return; setEditSaving(true); setEditError(""); try { const updated = await api.put(`/api/employees/${editingEmployee.id}`, payload); setRows((current) => current.map((row) => row.id === editingEmployee.id ? updated : row)); setEditingEmployee(null); } catch (e) { setEditError(mapProductionEntryError(e, "Không thể lưu nhân viên.")); } finally { setEditSaving(false); } }
  const columns = [{ key: "employeeCode", label: "Mã NV" }, { key: "fullName", label: "Họ tên" }, { key: "isActive", label: "Trạng thái", render: (row) => row.isActive ? "Đang hoạt động" : "Đã tắt" }, { key: "actions", label: "Thao tác", render: (row) => <button type="button" className="erp-button erp-button-secondary" onClick={() => { setEditingEmployee(row); setEditError(""); }}>Sửa</button> }];
  return <div className="erp-feature-page"><PageHeader title="Nhân viên" description="Quản lý hồ sơ nhân viên và trạng thái làm việc." actions={<button type="button" className="erp-button erp-button-primary" onClick={() => { setCreateOpen(true); setCreateError(""); }}>+ Thêm nhân viên</button>} />{error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}{shiftError && <Alert variant="warning" title="Bộ ca chưa sẵn sàng.">{shiftError}</Alert>}<FormSection title="Nhân viên" description="Tạo mới bằng popup để gán bộ ca và ngày hiệu lực ngay từ đầu." actions={<button type="button" className="erp-button erp-button-secondary" onClick={() => { setCreateOpen(true); setCreateError(""); }}>+ Thêm nhân viên</button>}><div className="erp-field-wide erp-section-description">Mỗi nhân viên mới cần được gán bộ ca HC trước khi nhập chấm công.</div></FormSection><DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="Chưa có nhân viên." rowKey="id" /><EmployeeDialog mode="create" open={createOpen} shifts={shiftTemplates} shiftLoading={shiftLoading} loading={createSaving} error={createError || shiftError} onClose={() => setCreateOpen(false)} onSubmit={submitCreate} onChange={() => setCreateError("")} /><EmployeeDialog open={Boolean(editingEmployee)} employee={editingEmployee} loading={editSaving} error={editError} onClose={() => setEditingEmployee(null)} onSubmit={submitEdit} onChange={() => setEditError("")} /></div>;
}
