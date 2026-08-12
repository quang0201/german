import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";

export function ProductionOrderListPage() {
  const [rows, setRows] = useState([]); const [form, setForm] = useState({ code: "", productName: "", plannedQuantity: "", status: "Draft" }); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const load = () => { setLoading(true); api.get("/api/production-orders").then(setRows).catch((e) => setError(e.message || "Không thể tải mã sản xuất.")).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function submit(event) { event.preventDefault(); setSaving(true); setError(""); try { await api.post("/api/production-orders", { ...form, plannedQuantity: Number(form.plannedQuantity), operations: null, cloneFromOrderId: null }); setForm({ code: "", productName: "", plannedQuantity: "", status: "Draft" }); load(); } catch (e) { setError(e.message || "Không thể tạo mã sản xuất."); } finally { setSaving(false); } }
  const columns = [{ key: "code", label: "Mã SX" }, { key: "productName", label: "Sản phẩm" }, { key: "plannedQuantity", label: "Kế hoạch" }, { key: "status", label: "Trạng thái" }, { key: "operations", label: "Công đoạn", render: (row) => row.operations?.length ?? 0 }];
  return <div className="erp-feature-page"><PageHeader title="Mã sản xuất" description="Quản lý mã sản xuất, kế hoạch và công đoạn." />{error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}<FormSection title="Tạo mã sản xuất"><Field label="Mã sản xuất" required><input className="erp-control" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field><Field label="Sản phẩm" required><input className="erp-control" required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Field><Field label="Số lượng kế hoạch" required><input className="erp-control" required min="0" type="number" value={form.plannedQuantity} onChange={(e) => setForm({ ...form, plannedQuantity: e.target.value })} /></Field><Field label="Trạng thái"><select className="erp-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Draft</option><option>InProduction</option><option>Completed</option><option>Cancelled</option></select></Field><div className="erp-field-wide erp-form-actions"><button className="erp-button erp-button-primary" type="submit" form="order-create" disabled={saving}>{saving ? "Đang lưu..." : "Tạo mã sản xuất"}</button></div></FormSection><form id="order-create" onSubmit={submit} hidden /><DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="Chưa có mã sản xuất." rowKey="id" /></div>;
}
