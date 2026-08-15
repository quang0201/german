import React, { useEffect, useRef, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { navigate } from "../../app/navigation.js";
import { api } from "../../lib/api.js";
import { orderStatusLabel } from "../../lib/i18n.js";
import { buildProductionOrderPayload, formatFixedPrice, resolveProductionOrderDetailDraft, resolveProductionOrderView, shouldLoadProductionOrderList, shouldResetProductionOrderCreateDraft } from "./productionOrderForm.js";
import { emptyProductionOperation, productionOperationForm, productionOperationPayload } from "./productionOperationDialog.js";
import { ProductionOperationDialog } from "./ProductionOperationDialog.jsx";

const STATUSES = ["Draft", "InProduction", "Completed", "Cancelled"];

function emptyOrder() {
  return { code: "", productName: "", plannedQuantity: "", status: "Draft", startDate: "", endDate: "", operations: [] };
}

export function ProductionOrderListPage({ params, pathname }) {
  const detailId = params?.id ?? "";
  const view = resolveProductionOrderView(pathname, detailId);
  const isCreateRoute = view === "create";
  const isListRoute = view === "list";
  const previousViewRef = useRef(view);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyOrder);
  const [detail, setDetail] = useState(emptyOrder);
  const [operationDialog, setOperationDialog] = useState(null);
  const [operationDeleteId, setOperationDeleteId] = useState("");
  const [operationError, setOperationError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load({ preserveDetail = false } = {}) {
    setLoading(true);
    setError("");
    try {
      const [items, selectedOrder] = await Promise.all([
        shouldLoadProductionOrderList(view) ? api.get("/api/production-orders") : Promise.resolve([]),
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

  useEffect(() => {
    if (shouldResetProductionOrderCreateDraft(previousViewRef.current, view)) {
      setForm(emptyOrder());
      setOperationDialog(null);
      setOperationDeleteId("");
      setOperationError("");
      setError("");
    }
    previousViewRef.current = view;
    load();
  }, [detailId, view]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function removeCreateOperation(index) {
    setForm((current) => ({ ...current, operations: current.operations.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function openCreateOperationDialog() {
    setOperationError("");
    setOperationDialog({ scope: "create", mode: "create", index: null, operation: emptyProductionOperation() });
  }

  function openCreateOperationEdit(index, item) {
    setOperationError("");
    setOperationDialog({ scope: "create", mode: "edit", index, operation: productionOperationForm(item) });
  }

  function openDetailOperationDialog(mode, item = null) {
    setOperationError("");
    setOperationDialog({ scope: "detail", mode, operation: item ? productionOperationForm(item) : emptyProductionOperation(), item });
  }

  function closeOperationDialog() {
    if (!saving) {
      setOperationError("");
      setOperationDialog(null);
    }
  }

  async function submitOperationDialog(operationDraft) {
    if (!operationDialog) return;
    if (operationDialog.scope === "create") {
      setForm((current) => {
        const operations = [...current.operations];
        const item = { ...operationDraft };
        if (operationDialog.mode === "edit") operations[operationDialog.index] = item;
        else operations.push(item);
        return { ...current, operations };
      });
      setOperationDialog(null);
      return;
    }

    if (!selected) return;
    setSaving(true);
    setOperationError("");
    try {
      const payload = productionOperationPayload(operationDraft);
      if (operationDialog.mode === "edit") {
        await api.put(`/api/production-orders/${selected.id}/operations/${operationDialog.item.id}`, payload);
      } else {
        await api.post(`/api/production-orders/${selected.id}/operations`, payload);
      }
      setOperationDialog(null);
      setOperationError("");
      await load({ preserveDetail: true });
    } catch (requestError) {
      setOperationError(requestError.message || "Không thể lưu công đoạn.");
    } finally {
      setSaving(false);
    }
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

  async function setOperationActive(item, isActive) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/production-orders/${selected.id}/operations/${item.id}`, productionOperationPayload({ ...item, isActive }));
      await load({ preserveDetail: true });
    } catch (requestError) {
      setError(requestError.message || "Không thể cập nhật trạng thái công đoạn.");
    } finally {
      setSaving(false);
    }
  }

  async function cleanupTargetOperation(item) {
    if (!selected) return;
    if (operationDeleteId !== item.id) {
      setOperationDeleteId(item.id);
      setError("");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api.post("/api/production-orders/0417/operations/567/cleanup");
      setOperationDeleteId("");
      await load({ preserveDetail: true });
    } catch (requestError) {
      setError(requestError.message || "Không thể xóa công đoạn và dữ liệu liên quan.");
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
      <PageHeader title={isCreateRoute ? "Tạo mã sản xuất" : detailId ? "Chi tiết mã sản xuất" : "Mã sản xuất"} description="Quản lý Mã SX, công đoạn và giá cố định." actions={isListRoute ? <button type="button" className="erp-button erp-button-primary" onClick={() => navigate("/orders/new")}>+ Tạo Mã SX</button> : <button type="button" className="erp-button erp-button-secondary" onClick={() => navigate("/orders")}>Quay lại danh sách</button>} />
      {error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}

      {isCreateRoute && <>
        <FormSection title="Thông tin Mã SX" description="Khai báo thông tin chung trước khi thêm công đoạn.">
          <form id="order-create" onSubmit={createOrder}>
            <Field label="Mã SX" required><input form="order-create" className="erp-control" required value={form.code} onChange={(event) => updateForm("code", event.target.value)} /></Field>
            <Field label="Sản phẩm" required><input form="order-create" className="erp-control" required value={form.productName} onChange={(event) => updateForm("productName", event.target.value)} /></Field>
            <Field label="Số lượng kế hoạch" required><input form="order-create" className="erp-control" required min="0" step="0.01" type="number" value={form.plannedQuantity} onChange={(event) => updateForm("plannedQuantity", event.target.value)} /></Field>
            <Field label="Trạng thái"><select form="order-create" className="erp-control" value={form.status} onChange={(event) => updateForm("status", event.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{orderStatusLabel(status)}</option>)}</select></Field>
            <Field label="Ngày bắt đầu"><input className="erp-control" type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></Field>
            <Field label="Ngày kết thúc"><input className="erp-control" type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} /></Field>
          </form>
        </FormSection>
        <FormSection title="Công đoạn" description="Thêm công đoạn bằng popup; danh sách chỉ hiển thị thông tin đã khai báo.">
          <div className="erp-field-wide erp-table-wrap">
            <table className="erp-table"><thead><tr><th>Số CĐ</th><th>Tên công đoạn</th><th>ĐVT</th><th>Giá cố định</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
              {form.operations.map((item, index) => <tr key={index}><td>CĐ{item.operationNumber}</td><td>{item.name}</td><td>{item.unit}</td><td>{formatFixedPrice(item.fixedPrice)}</td><td>{item.isActive ? "Hoạt động" : "Đã tắt"}</td><td><button type="button" className="erp-button erp-button-link" onClick={() => openCreateOperationEdit(index, item)}>Sửa</button> <button type="button" className="erp-button erp-button-link" onClick={() => removeCreateOperation(index)}>Xóa</button></td></tr>)}
              {!form.operations.length && <tr><td colSpan="6">Chưa có công đoạn.</td></tr>}
            </tbody></table>
          </div>
          <div className="erp-field-wide erp-form-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={openCreateOperationDialog}>+ Thêm công đoạn</button>
            <button type="submit" className="erp-button erp-button-primary" form="order-create" disabled={saving}>{saving ? "Đang tạo..." : "Tạo mã sản xuất"}</button>
          </div>
        </FormSection>
      </>}

      {isListRoute && <DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="Chưa có mã sản xuất." rowKey="id" onRowClick={(row) => navigate(`/orders/${row.id}`)} />}

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
          <FormSection title="Công đoạn" description="Tắt để giữ lịch sử. Cleanup dữ liệu chỉ áp dụng cho CĐ567 của Mã SX 0417.">
            <div className="erp-field-wide erp-table-wrap"><table className="erp-table"><thead><tr><th>Số CĐ</th><th>Tên</th><th>ĐVT</th><th>Giá cố định</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
              {selected.operations.map((item) => { const isCleanupTarget = selected.code === "0417" && item.operationNumber === 567; return <tr key={item.id}><td>CĐ{item.operationNumber}</td><td>{item.name}</td><td>{item.unit}</td><td>{formatFixedPrice(item.fixedPrice)}</td><td>{item.isActive ? "Hoạt động" : "Đã tắt"}</td><td><button type="button" className="erp-button erp-button-link" onClick={() => openDetailOperationDialog("edit", item)}>Sửa</button> <button type="button" className="erp-button erp-button-link" onClick={() => setOperationActive(item, !item.isActive)} disabled={saving}>{item.isActive ? "Tắt" : "Bật"}</button>{isCleanupTarget && (operationDeleteId === item.id ? <><span className="erp-inline-message erp-inline-error">Xóa dữ liệu CĐ567 của Mã SX 0417</span> <button type="button" className="erp-button erp-button-danger" onClick={() => cleanupTargetOperation(item)} disabled={saving}>Xác nhận xóa</button> <button type="button" className="erp-button erp-button-link" onClick={() => setOperationDeleteId("")} disabled={saving}>Hủy</button></> : <button type="button" className="erp-button erp-button-link" onClick={() => cleanupTargetOperation(item)} disabled={saving}>Xóa dữ liệu CĐ567</button>)}</td></tr>; })}
              {!selected.operations.length && <tr><td colSpan="6">Chưa có công đoạn.</td></tr>}
            </tbody></table></div>
            <div className="erp-field-wide erp-form-actions"><button type="button" className="erp-button erp-button-secondary" onClick={() => openDetailOperationDialog("create")}>+ Thêm công đoạn</button></div>
          </FormSection>
        </>}
      </>}
      <ProductionOperationDialog
        open={Boolean(operationDialog)}
        mode={operationDialog?.mode}
        operation={operationDialog?.operation}
        loading={saving}
        error={operationError}
        onClose={closeOperationDialog}
        onChange={() => setOperationError("")}
        onSubmit={submitOperationDialog}
      />
    </div>
  );
}
