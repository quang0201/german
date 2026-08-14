import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { navigate } from "../../app/navigation.js";
import { api } from "../../lib/api.js";
import { orderStatusLabel } from "../../lib/i18n.js";
import { buildProductionOrderPayload, formatFixedPrice, resolveProductionOrderDetailDraft } from "./productionOrderForm.js";

const STATUSES = ["Draft", "InProduction", "Completed", "Cancelled"];

function emptyOperation() {
  return { operationNumber: "", name: "", unit: "cái", fixedPrice: "", sortOrder: "", isActive: true };
}

function emptyOrder() {
  return { code: "", productName: "", plannedQuantity: "", status: "Draft", startDate: "", endDate: "", operations: [] };
}

function operationPayload(operation) {
  return {
    operationNumber: Number(operation.operationNumber),
    name: operation.name.trim(),
    unit: operation.unit.trim(),
    fixedPrice: operation.fixedPrice === "" || operation.fixedPrice === null || operation.fixedPrice === undefined ? null : Number(operation.fixedPrice),
    sortOrder: Number(operation.sortOrder || operation.operationNumber),
    isActive: operation.isActive !== false,
  };
}

export function ProductionOrderListPage({ params }) {
  const detailId = params?.id ?? "";
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyOrder);
  const [detail, setDetail] = useState(emptyOrder);
  const [operation, setOperation] = useState(emptyOperation);
  const [editingId, setEditingId] = useState("");
  const [editingOperation, setEditingOperation] = useState(emptyOperation);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load({ preserveDetail = false } = {}) {
    setLoading(true);
    setError("");
    try {
      const [items, selectedOrder] = await Promise.all([
        api.get("/api/production-orders"),
        detailId ? api.get(`/api/production-orders/${detailId}`) : Promise.resolve(null),
      ]);
      setRows(items);
      setSelected(selectedOrder);
      if (selectedOrder) setDetail((current) => resolveProductionOrderDetailDraft(selectedOrder, current, preserveDetail));
    } catch (requestError) {
      setError(requestError.message || "Không thể tải mã sản xuất.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [detailId]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function updateOperation(index, key, value) {
    setForm((current) => ({
      ...current,
      operations: current.operations.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  function addCreateOperation() {
    setForm((current) => ({ ...current, operations: [...current.operations, emptyOperation()] }));
  }

  function removeCreateOperation(index) {
    setForm((current) => ({ ...current, operations: current.operations.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function createOrder(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await api.post("/api/production-orders", buildProductionOrderPayload(form));
      setForm(emptyOrder());
      navigate(`/orders/${created.id}`);
    } catch (requestError) {
      setError(requestError.message || "Không thể tạo mã sản xuất.");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrder(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/production-orders/${selected.id}`, {
        ...detail,
        plannedQuantity: Number(detail.plannedQuantity),
        startDate: detail.startDate || null,
        endDate: detail.endDate || null,
      });
      await load();
    } catch (requestError) {
      setError(requestError.message || "Không thể cập nhật mã sản xuất.");
    } finally {
      setSaving(false);
    }
  }

  async function addOperation(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/production-orders/${selected.id}/operations`, operationPayload(operation));
      setOperation(emptyOperation());
      await load({ preserveDetail: true });
    } catch (requestError) {
      setError(requestError.message || "Không thể thêm công đoạn.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item) {
    setEditingId(item.id);
    setEditingOperation({ ...item, fixedPrice: item.fixedPrice ?? "" });
  }

  async function saveOperation(event) {
    event.preventDefault();
    if (!selected || !editingId) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/production-orders/${selected.id}/operations/${editingId}`, operationPayload(editingOperation));
      setEditingId("");
      await load({ preserveDetail: true });
    } catch (requestError) {
      setError(requestError.message || "Không thể cập nhật công đoạn.");
    } finally {
      setSaving(false);
    }
  }

  async function setOperationActive(item, isActive) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/production-orders/${selected.id}/operations/${item.id}`, operationPayload({ ...item, isActive }));
      await load({ preserveDetail: true });
    } catch (requestError) {
      setError(requestError.message || "Không thể cập nhật trạng thái công đoạn.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "code", label: "Mã SX" },
    { key: "productName", label: "Sản phẩm" },
    { key: "plannedQuantity", label: "Kế hoạch" },
    { key: "status", label: "Trạng thái", render: (row) => orderStatusLabel(row.status) },
    { key: "operations", label: "Công đoạn", render: (row) => row.operations?.length ?? 0 },
    { key: "action", label: "Thao tác", render: () => <span className="erp-table-action">Xem / sửa</span> },
  ];

  return (
    <div className="erp-feature-page">
      <PageHeader title={detailId ? "Chi tiết mã sản xuất" : "Mã sản xuất"} description="Quản lý Mã SX, công đoạn và giá cố định." actions={detailId ? <button type="button" className="erp-button erp-button-secondary" onClick={() => navigate("/orders")}>Quay lại danh sách</button> : undefined} />
      {error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}

      {!detailId && <FormSection title="Tạo mã sản xuất" description="Có thể khai báo công đoạn ngay khi tạo Mã SX.">
        <form id="order-create" onSubmit={createOrder}>
        <Field label="Mã SX" required><input form="order-create" className="erp-control" required value={form.code} onChange={(event) => updateForm("code", event.target.value)} /></Field>
        <Field label="Sản phẩm" required><input form="order-create" className="erp-control" required value={form.productName} onChange={(event) => updateForm("productName", event.target.value)} /></Field>
        <Field label="Số lượng kế hoạch" required><input form="order-create" className="erp-control" required min="0" step="0.01" type="number" value={form.plannedQuantity} onChange={(event) => updateForm("plannedQuantity", event.target.value)} /></Field>
        <Field label="Trạng thái"><select form="order-create" className="erp-control" value={form.status} onChange={(event) => updateForm("status", event.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{orderStatusLabel(status)}</option>)}</select></Field>
        <Field label="Ngày bắt đầu"><input className="erp-control" type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></Field>
        <Field label="Ngày kết thúc"><input className="erp-control" type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} /></Field>
        <div className="erp-field-wide">
          <div className="erp-field-label">Công đoạn</div>
          <div className="erp-table-wrap">
            <table className="erp-table"><thead><tr><th>Số CĐ</th><th>Tên công đoạn</th><th>ĐVT</th><th>Giá cố định</th><th>Hoạt động</th><th /></tr></thead><tbody>
              {form.operations.map((item, index) => <tr key={index}><td><input className="erp-control" required min="1" type="number" value={item.operationNumber} onChange={(event) => updateOperation(index, "operationNumber", event.target.value)} /></td><td><input className="erp-control" required value={item.name} onChange={(event) => updateOperation(index, "name", event.target.value)} /></td><td><input className="erp-control" required value={item.unit} onChange={(event) => updateOperation(index, "unit", event.target.value)} /></td><td><input className="erp-control" required min="0" step="0.01" type="number" value={item.fixedPrice} onChange={(event) => updateOperation(index, "fixedPrice", event.target.value)} /></td><td><input type="checkbox" checked={item.isActive} onChange={(event) => updateOperation(index, "isActive", event.target.checked)} /></td><td><button type="button" className="erp-button erp-button-link" onClick={() => removeCreateOperation(index)}>Xóa</button></td></tr>)}
              {!form.operations.length && <tr><td colSpan="6">Chưa có công đoạn.</td></tr>}
            </tbody></table>
          </div>
          <button type="button" className="erp-button erp-button-secondary" onClick={addCreateOperation}>+ Thêm công đoạn</button>
        </div>
        <div className="erp-field-wide erp-form-actions"><button type="submit" className="erp-button erp-button-primary" form="order-create" disabled={saving}>{saving ? "Đang tạo..." : "Tạo mã sản xuất"}</button></div>
        </form>
      </FormSection>}

      {!detailId && <DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="Chưa có mã sản xuất." rowKey="id" onRowClick={(row) => navigate(`/orders/${row.id}`)} />}

      {detailId && <>
        {loading && <div className="erp-table-state">Đang tải chi tiết mã sản xuất...</div>}
        {!loading && !selected && <div className="erp-table-state">Không tìm thấy mã sản xuất.</div>}
        {selected && <>
          <FormSection title={`${selected.code} — ${selected.productName}`} description="Cập nhật thông tin chung của Mã SX." >
            <form id="production-order-detail" onSubmit={updateOrder} />
            <Field label="Mã SX" required><input form="production-order-detail" className="erp-control" required value={detail.code} onChange={(event) => setDetail((current) => ({ ...current, code: event.target.value }))} /></Field>
            <Field label="Sản phẩm" required><input form="production-order-detail" className="erp-control" required value={detail.productName} onChange={(event) => setDetail((current) => ({ ...current, productName: event.target.value }))} /></Field>
            <Field label="Số lượng kế hoạch" required><input form="production-order-detail" className="erp-control" required min="0" step="0.01" type="number" value={detail.plannedQuantity} onChange={(event) => setDetail((current) => ({ ...current, plannedQuantity: event.target.value }))} /></Field>
            <Field label="Trạng thái"><select form="production-order-detail" className="erp-control" value={detail.status} onChange={(event) => setDetail((current) => ({ ...current, status: event.target.value }))}>{STATUSES.map((status) => <option key={status} value={status}>{orderStatusLabel(status)}</option>)}</select></Field>
            <Field label="Ngày bắt đầu"><input form="production-order-detail" className="erp-control" type="date" value={detail.startDate} onChange={(event) => setDetail((current) => ({ ...current, startDate: event.target.value }))} /></Field>
            <Field label="Ngày kết thúc"><input form="production-order-detail" className="erp-control" type="date" value={detail.endDate} onChange={(event) => setDetail((current) => ({ ...current, endDate: event.target.value }))} /></Field>
            <div className="erp-field-wide erp-form-actions"><button form="production-order-detail" type="submit" className="erp-button erp-button-primary" disabled={saving}>Lưu thông tin Mã SX</button></div>
          </FormSection>
          <FormSection title="Công đoạn" description="Không xóa cứng công đoạn đã có dữ liệu; dùng Tắt để giữ lịch sử.">
            <div className="erp-field-wide erp-table-wrap"><table className="erp-table"><thead><tr><th>Số CĐ</th><th>Tên</th><th>ĐVT</th><th>Giá cố định</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
              {selected.operations.map((item) => editingId === item.id ? <tr key={item.id}><td><input className="erp-control" min="1" type="number" value={editingOperation.operationNumber} onChange={(event) => setEditingOperation((current) => ({ ...current, operationNumber: event.target.value }))} /></td><td><input className="erp-control" value={editingOperation.name} onChange={(event) => setEditingOperation((current) => ({ ...current, name: event.target.value }))} /></td><td><input className="erp-control" value={editingOperation.unit} onChange={(event) => setEditingOperation((current) => ({ ...current, unit: event.target.value }))} /></td><td><input className="erp-control" min="0" step="0.01" type="number" value={editingOperation.fixedPrice} onChange={(event) => setEditingOperation((current) => ({ ...current, fixedPrice: event.target.value }))} /></td><td><input type="checkbox" checked={editingOperation.isActive} onChange={(event) => setEditingOperation((current) => ({ ...current, isActive: event.target.checked }))} /></td><td><button type="button" className="erp-button erp-button-primary" onClick={saveOperation} disabled={saving}>Lưu</button> <button type="button" className="erp-button erp-button-link" onClick={() => setEditingId("")}>Hủy</button></td></tr> : <tr key={item.id}><td>CĐ{item.operationNumber}</td><td>{item.name}</td><td>{item.unit}</td><td>{formatFixedPrice(item.fixedPrice)}</td><td>{item.isActive ? "Hoạt động" : "Đã tắt"}</td><td><button type="button" className="erp-button erp-button-link" onClick={() => beginEdit(item)}>Sửa</button> <button type="button" className="erp-button erp-button-link" onClick={() => setOperationActive(item, !item.isActive)} disabled={saving}>{item.isActive ? "Tắt" : "Bật"}</button></td></tr>)}
              {!selected.operations.length && <tr><td colSpan="6">Chưa có công đoạn.</td></tr>}
            </tbody></table></div>
            <form onSubmit={addOperation} className="erp-field-wide erp-form-grid"><Field label="Số CĐ" required><input className="erp-control" required min="1" type="number" value={operation.operationNumber} onChange={(event) => setOperation((current) => ({ ...current, operationNumber: event.target.value }))} /></Field><Field label="Tên công đoạn" required><input className="erp-control" required value={operation.name} onChange={(event) => setOperation((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="ĐVT" required><input className="erp-control" required value={operation.unit} onChange={(event) => setOperation((current) => ({ ...current, unit: event.target.value }))} /></Field><Field label="Giá cố định" required hint=">= 0"><input className="erp-control" required min="0" step="0.01" type="number" value={operation.fixedPrice} onChange={(event) => setOperation((current) => ({ ...current, fixedPrice: event.target.value }))} /></Field><div className="erp-form-actions"><button type="submit" className="erp-button erp-button-secondary" disabled={saving}>+ Thêm công đoạn</button></div></form>
          </FormSection>
        </>}
      </>}
    </div>
  );
}
