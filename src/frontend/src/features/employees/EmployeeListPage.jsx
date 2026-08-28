import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { ConfirmDialog } from "../../components/erp/ConfirmDialog.jsx";
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
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  function loadEmployees() { setLoading(true); api.get("/api/employees").then(setRows).catch((e) => setError(mapProductionEntryError(e, "Không thể tải nhân viên."))).finally(() => setLoading(false)); }
  function loadShiftTemplates() { setShiftLoading(true); api.get("/api/shift-templates").then((items) => { setShiftTemplates(items); setShiftError(""); }).catch((e) => setShiftError(mapProductionEntryError(e, "Không thể tải bộ ca."))).finally(() => setShiftLoading(false)); }
  useEffect(() => { loadEmployees(); loadShiftTemplates(); }, []);
  async function submitCreate(payload) { setCreateSaving(true); setCreateError(""); try { await api.post("/api/employees", payload); setCreateOpen(false); loadEmployees(); } catch (e) { setCreateError(mapProductionEntryError(e, "Không thể tạo nhân viên và gán bộ ca.")); } finally { setCreateSaving(false); } }
  async function submitEdit(payload) { if (!editingEmployee) return; setEditSaving(true); setEditError(""); try { const updated = await api.put(`/api/employees/${editingEmployee.id}`, payload); setRows((current) => current.map((row) => row.id === editingEmployee.id ? updated : row)); setEditingEmployee(null); } catch (e) { setEditError(mapProductionEntryError(e, "Không thể lưu nhân viên.")); } finally { setEditSaving(false); } }
  async function assignShift(payload) { if (!editingEmployee) return false; setAssignmentSaving(true); setAssignmentError(""); try { await api.post(`/api/employees/${editingEmployee.id}/shift-assignments`, payload); return true; } catch (e) { setAssignmentError(mapProductionEntryError(e, "Không thể gán bộ ca.")); return false; } finally { setAssignmentSaving(false); } }
  async function deleteEmployee(row) {
    setDeletingEmployeeId(row.id);
    setDeleteError("");
    try {
      await api.delete(`/api/employees/${row.id}`);
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, isActive: false } : item));
    } catch (e) {
      setDeleteError(mapProductionEntryError(e, "Không thể xóa nhân viên."));
    } finally {
      setDeletingEmployeeId(null);
      setConfirmingDelete(null);
    }
  }
  const columns = [{ key: "employeeCode", label: "Mã NV" }, { key: "fullName", label: "Họ tên" }, { key: "isActive", label: "Trạng thái", render: (row) => row.isActive ? "Đang hoạt động" : "Đã tắt" }, { key: "actions", label: "Thao tác", render: (row) => <div className="erp-table-actions"><button type="button" className="erp-button erp-button-secondary" onClick={() => { setEditingEmployee(row); setEditError(""); setAssignmentError(""); }}>Sửa</button>{row.isActive && <button type="button" className="erp-button erp-button-danger" disabled={deletingEmployeeId === row.id} onClick={() => setConfirmingDelete(row)}>{deletingEmployeeId === row.id ? "Đang xóa..." : "Xóa"}</button>}</div> }];
  return <div className="erp-feature-page"><PageHeader title="Nhân viên" description="Quản lý hồ sơ nhân viên và trạng thái làm việc." actions={<button type="button" className="erp-button erp-button-primary" onClick={() => { setCreateOpen(true); setCreateError(""); }}>+ Thêm nhân viên</button>} />{error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}{deleteError && <Alert variant="error" title="Không thể xóa nhân viên.">{deleteError}</Alert>}{shiftError && <Alert variant="warning" title="Bộ ca chưa sẵn sàng.">{shiftError}</Alert>}<FormSection title="Nhân viên" description="Tạo mới bằng popup để gán bộ ca và ngày hiệu lực ngay từ đầu." actions={<button type="button" className="erp-button erp-button-secondary" onClick={() => { setCreateOpen(true); setCreateError(""); }}>+ Thêm nhân viên</button>}><div className="erp-field-wide erp-section-description">Mỗi nhân viên mới cần được gán bộ ca HC trước khi nhập chấm công.</div></FormSection><DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="Chưa có nhân viên." rowKey="id" rowClassName={(row) => row.isActive === false ? "erp-employee-inactive" : ""} /><EmployeeDialog mode="create" open={createOpen} shifts={shiftTemplates} shiftLoading={shiftLoading} loading={createSaving} error={createError || shiftError} onClose={() => setCreateOpen(false)} onSubmit={submitCreate} onChange={() => setCreateError("")} /><EmployeeDialog open={Boolean(editingEmployee)} employee={editingEmployee} shifts={shiftTemplates} shiftLoading={shiftLoading} loading={editSaving} assignmentLoading={assignmentSaving} error={editError} assignmentError={assignmentError} onClose={() => { setEditingEmployee(null); setAssignmentError(""); }} onSubmit={submitEdit} onAssignShift={assignShift} onChange={() => { setEditError(""); setAssignmentError(""); }} /><ConfirmDialog open={Boolean(confirmingDelete)} title="Xác nhận xóa nhân viên?" confirmLabel="Xóa nhân viên" loading={Boolean(deletingEmployeeId)} onClose={() => setConfirmingDelete(null)} onConfirm={() => deleteEmployee(confirmingDelete)}>Nhân viên {confirmingDelete?.employeeCode} — {confirmingDelete?.fullName} sẽ được chuyển sang trạng thái đã tắt. Lịch sử chấm công vẫn được giữ lại.</ConfirmDialog></div>;
}
