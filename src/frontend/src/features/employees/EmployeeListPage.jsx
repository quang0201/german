import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { mapProductionEntryError } from "../production-entries/productionEntryErrors.js";

export function EmployeeListPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ employeeCode: "", fullName: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = () => { setLoading(true); api.get("/api/employees").then(setRows).catch((e) => setError(mapProductionEntryError(e, "Không thể tải nhân viên."))).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function submit(event) { event.preventDefault(); setSaving(true); setError(""); try { await api.post("/api/employees", form); setForm({ employeeCode: "", fullName: "" }); load(); } catch (e) { setError(mapProductionEntryError(e, "Không thể tạo nhân viên.")); } finally { setSaving(false); } }
  const columns = [{ key: "employeeCode", label: "Mã NV" }, { key: "fullName", label: "Họ tên" }, { key: "isActive", label: "Trạng thái", render: (row) => row.isActive ? "Đang hoạt động" : "Đã tắt" }];
  return <div className="erp-feature-page"><PageHeader title="Nhân viên" description="Quản lý hồ sơ nhân viên và trạng thái làm việc." />{error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}<FormSection title="Thêm nhân viên"><Field label="Mã nhân viên" required><input className="erp-control" required value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} /></Field><Field label="Họ tên" required><input className="erp-control" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field><div className="erp-field-wide erp-form-actions"><button type="submit" className="erp-button erp-button-primary" form="employee-create" disabled={saving}>{saving ? "Đang lưu..." : "Thêm nhân viên"}</button></div></FormSection><form id="employee-create" onSubmit={submit} hidden /><DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="Chưa có nhân viên." rowKey="id" /></div>;
}
