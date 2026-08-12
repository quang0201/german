import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";

export function ShiftListPage() {
  const [rows, setRows] = useState([]); const [name, setName] = useState("Ca hành chính"); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const load = () => api.get("/api/shift-templates").then(setRows).catch((e) => setError(e.message || "Không thể tải ca làm việc.")); useEffect(() => { load(); }, []);
  async function submit(event) { event.preventDefault(); setSaving(true); setError(""); try { await api.post("/api/shift-templates", { name, periods: [{ name: "Ca 1", startTime: "07:00:00", endTime: "11:30:00", sortOrder: 1 }, { name: "Ca 2", startTime: "12:30:00", endTime: "17:00:00", sortOrder: 2 }] }); setName("Ca hành chính"); load(); } catch (e) { setError(e.message || "Không thể tạo bộ ca."); } finally { setSaving(false); } }
  const columns = [{ key: "name", label: "Tên bộ ca" }, { key: "totalHours", label: "Tổng giờ" }, { key: "periods", label: "Khung giờ", render: (row) => row.periods?.map((p) => `${p.name} ${String(p.startTime).slice(0, 5)}–${String(p.endTime).slice(0, 5)}`).join(" · ") }];
  return <div className="erp-feature-page"><PageHeader title="Ca làm việc" description="Quản lý bộ ca và khung giờ HC." />{error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}<FormSection title="Tạo bộ ca"><Field label="Tên bộ ca" required><input form="shift-create" className="erp-control" required value={name} onChange={(e) => setName(e.target.value)} /></Field><div className="erp-form-actions"><button className="erp-button erp-button-primary" type="submit" form="shift-create" disabled={saving}>{saving ? "Đang lưu..." : "Tạo bộ ca"}</button></div></FormSection><form id="shift-create" onSubmit={submit} hidden /><DataTable columns={columns} rows={rows} loading={false} error={error} emptyMessage="Chưa có bộ ca." rowKey="id" /></div>;
}
