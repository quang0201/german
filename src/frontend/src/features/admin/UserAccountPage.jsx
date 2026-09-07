import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { ConfirmDialog } from "../../components/erp/ConfirmDialog.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { roleLabel } from "../../lib/i18n.js";
import { UserAccountDialog } from "./UserAccountDialog.jsx";

export function UserAccountPage() {
  const [accounts, setAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingAccountId, setDeletingAccountId] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  const load = () => Promise.all([
    api.get("/api/admin/user-accounts"),
    api.get("/api/employees"),
  ]).then(([accountRows, employeeRows]) => {
    setAccounts(accountRows);
    setEmployees(employeeRows);
    setError("");
  }).catch((requestError) => setError(requestError.message || "Không thể tải tài khoản."));

  useEffect(() => { load(); }, []);

  const assignedIds = useMemo(
    () => new Set(accounts.filter((account) => account.employeeId).map((account) => String(account.employeeId))),
    [accounts],
  );

  async function submitCreate(payload) {
    setCreateSaving(true);
    setCreateError("");
    try {
      await api.post("/api/admin/user-accounts", payload);
      setCreateOpen(false);
      await load();
    } catch (requestError) {
      setCreateError(requestError.message || "Không thể tạo tài khoản.");
    } finally {
      setCreateSaving(false);
    }
  }

  async function submitEdit(payload) {
    if (!editingAccount) return;
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await api.put(`/api/admin/user-accounts/${editingAccount.id}`, payload);
      setAccounts((current) => current.map((row) => row.id === editingAccount.id ? updated : row));
      setEditingAccount(null);
    } catch (requestError) {
      setEditError(requestError.message || "Không thể lưu tài khoản.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteAccount(row) {
    if (!row) return;
    setDeletingAccountId(row.id);
    setDeleteError("");
    try {
      await api.delete(`/api/admin/user-accounts/${row.id}`);
      setAccounts((current) => current.map((item) => item.id === row.id ? { ...item, isActive: false } : item));
    } catch (requestError) {
      setDeleteError(requestError.message || "Không thể xóa tài khoản.");
    } finally {
      setDeletingAccountId(null);
      setConfirmingDelete(null);
    }
  }

  const columns = [
    { key: "username", label: "Tên đăng nhập" },
    { key: "role", label: "Vai trò", render: (row) => roleLabel(row.role) },
    { key: "employeeName", label: "Nhân viên", render: (row) => row.employeeCode ? `${row.employeeCode} — ${row.employeeName}` : "Không gắn nhân viên" },
    { key: "isActive", label: "Trạng thái", render: (row) => row.isActive ? "Đang hoạt động" : "Đã tắt" },
    {
      key: "actions",
      label: "Thao tác",
      render: (row) => (
        <div className="erp-table-actions">
          <button type="button" className="erp-button erp-button-secondary" onClick={() => { setEditingAccount(row); setEditError(""); }}>
            Sửa
          </button>
          {row.isActive && (
            <button type="button" className="erp-button erp-button-danger" disabled={deletingAccountId === row.id} onClick={() => setConfirmingDelete(row)}>
              {deletingAccountId === row.id ? "Đang xóa..." : "Xóa"}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="erp-feature-page">
      <PageHeader
        title="Tài khoản"
        description="Quản lý tài khoản và vai trò truy cập."
        actions={<button type="button" className="erp-button erp-button-primary" onClick={() => { setCreateOpen(true); setCreateError(""); }}>+ Tạo tài khoản</button>}
      />
      {error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}
      {deleteError && <Alert variant="error" title="Không thể xóa tài khoản.">{deleteError}</Alert>}
      <div className="erp-section-description">Dùng popup để tạo, sửa hoặc xóa tài khoản. Xóa sẽ chuyển tài khoản sang trạng thái đã tắt và giữ nguyên lịch sử.</div>
      <DataTable columns={columns} rows={accounts} loading={false} error={error} emptyMessage="Chưa có tài khoản." rowKey="id" />
      <UserAccountDialog mode="create" open={createOpen} employees={employees} assignedIds={assignedIds} loading={createSaving} error={createError} onClose={() => setCreateOpen(false)} onSubmit={submitCreate} onChange={() => setCreateError("")} />
      <UserAccountDialog mode="edit" open={Boolean(editingAccount)} account={editingAccount} employees={employees} assignedIds={assignedIds} loading={editSaving} error={editError} onClose={() => setEditingAccount(null)} onSubmit={submitEdit} onChange={() => setEditError("")} />
      <ConfirmDialog
        open={Boolean(confirmingDelete)}
        title="Xác nhận xóa tài khoản?"
        confirmLabel="Xóa tài khoản"
        loading={Boolean(deletingAccountId)}
        onClose={() => setConfirmingDelete(null)}
        onConfirm={() => deleteAccount(confirmingDelete)}
      >
        Tài khoản {confirmingDelete?.username} sẽ được chuyển sang trạng thái đã tắt. Lịch sử vẫn được giữ lại.
      </ConfirmDialog>
    </div>
  );
}
