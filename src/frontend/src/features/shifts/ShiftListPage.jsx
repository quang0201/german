import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { ConfirmDialog } from "../../components/erp/ConfirmDialog.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { buildShiftUpdatePayload } from "./shiftTemplateDialog.js";
import { ShiftTemplateDialog } from "./ShiftTemplateDialog.jsx";

const emptyShift = {
  name: "Ca hành chính",
  isActive: true,
  periods: [
    { name: "Ca 1", startTime: "07:00", endTime: "11:30" },
    { name: "Ca 2", startTime: "12:30", endTime: "17:00" },
  ],
};

export function ShiftListPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [deletingShiftId, setDeletingShiftId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const load = () => api.get("/api/shift-templates")
    .then(setRows)
    .catch((requestError) => setError(requestError.message || "Không thể tải ca làm việc."));

  useEffect(() => { load(); }, []);

  async function submitCreate(payload) {
    setCreateSaving(true);
    setCreateError("");
    try {
      const { isActive, ...createPayload } = payload;
      await api.post("/api/shift-templates", createPayload);
      setCreateOpen(false);
      await load();
    } catch (requestError) {
      setCreateError(requestError.message || "Không thể tạo bộ ca.");
    } finally {
      setCreateSaving(false);
    }
  }

  async function submitEdit(payload) {
    if (!editingShift) return;
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await api.put(`/api/shift-templates/${editingShift.id}`, payload);
      setRows((current) => current.map((row) => row.id === editingShift.id ? updated : row));
      setEditingShift(null);
    } catch (requestError) {
      setEditError(requestError.message || "Không thể lưu bộ ca.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteShift(row) {
    if (!row) return;
    setDeletingShiftId(row.id);
    setDeleteError("");
    try {
      const payload = { ...buildShiftUpdatePayload(row), isActive: false };
      const updated = await api.put(`/api/shift-templates/${row.id}`, payload);
      setRows((current) => current.map((item) => item.id === row.id ? updated : item));
    } catch (requestError) {
      setDeleteError(requestError.message || "Không thể xóa bộ ca.");
    } finally {
      setDeletingShiftId(null);
      setConfirmingDelete(null);
    }
  }

  const columns = [
    { key: "name", label: "Tên bộ ca" },
    { key: "totalHours", label: "Tổng giờ" },
    { key: "periods", label: "Khung giờ", render: (row) => row.periods?.map((period) => `${period.name} ${String(period.startTime).slice(0, 5)}–${String(period.endTime).slice(0, 5)}`).join(" · ") },
    { key: "isActive", label: "Trạng thái", render: (row) => row.isActive ? "Đang hoạt động" : "Đã tắt" },
    {
      key: "actions",
      label: "Thao tác",
      render: (row) => (
        <div className="erp-table-actions">
          <button type="button" className="erp-button erp-button-secondary" onClick={() => { setEditingShift(row); setEditError(""); }}>
            Sửa
          </button>
          {row.isActive && <button type="button" className="erp-button erp-button-danger" disabled={deletingShiftId === row.id} onClick={() => setConfirmingDelete(row)}>
            {deletingShiftId === row.id ? "Đang xóa..." : "Xóa"}
          </button>}
        </div>
      ),
    },
  ];

  return (
    <div className="erp-feature-page">
      <PageHeader title="Ca làm việc" description="Quản lý bộ ca và khung giờ HC." actions={<button type="button" className="erp-button erp-button-primary" onClick={() => { setCreateOpen(true); setCreateError(""); }}>+ Tạo bộ ca</button>} />
      {error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}
      {deleteError && <Alert variant="error" title="Không thể xóa bộ ca.">{deleteError}</Alert>}
      <div className="erp-section-description">Dùng popup để tạo, sửa hoặc xóa bộ ca. Xóa sẽ tắt bộ ca và giữ nguyên lịch sử chấm công.</div>
      <DataTable columns={columns} rows={rows} loading={false} error={error} emptyMessage="Chưa có bộ ca." rowKey="id" />
      <ShiftTemplateDialog mode="create" open={createOpen} shift={emptyShift} loading={createSaving} error={createError} onClose={() => setCreateOpen(false)} onSubmit={submitCreate} onChange={() => setCreateError("")} />
      <ShiftTemplateDialog mode="edit" open={Boolean(editingShift)} shift={editingShift} loading={editSaving} error={editError} onClose={() => setEditingShift(null)} onSubmit={submitEdit} onChange={() => setEditError("")} />
      <ConfirmDialog open={Boolean(confirmingDelete)} title="Xác nhận xóa bộ ca?" confirmLabel="Xóa bộ ca" loading={Boolean(deletingShiftId)} onClose={() => setConfirmingDelete(null)} onConfirm={() => deleteShift(confirmingDelete)}>
        Bộ ca {confirmingDelete?.name} sẽ được chuyển sang trạng thái đã tắt. Lịch sử chấm công vẫn được giữ lại.
      </ConfirmDialog>
    </div>
  );
}
