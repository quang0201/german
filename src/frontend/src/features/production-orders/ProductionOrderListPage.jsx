import React, { useEffect, useRef, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { navigate } from "../../app/navigation.js";
import { api } from "../../lib/api.js";
import { orderStatusLabel } from "../../lib/i18n.js";
import { buildProductionOrderPayload, formatFixedPrice, resolveProductionOrderDetailDraft, resolveProductionOrderView, shouldLoadProductionOrderList, shouldResetProductionOrderCreateDraft } from "./productionOrderForm.js";
import { emptyProductionOperation, productionOperationForm, productionOperationPayload } from "./productionOperationDialog.js";
import { ProductionOperationDialog } from "./ProductionOperationDialog.jsx";
import { ProductionExternalQuantityDialog } from "./ProductionExternalQuantityDialog.jsx";
import { ProductionOrderDialog } from "./ProductionOrderDialog.jsx";
import { ConfirmDialog } from "../../components/erp/ConfirmDialog.jsx";
import { groupProductionExternalHistory } from "./productionExternalHistory.js";

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
  const [editingOrder, setEditingOrder] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState(null);
  const [operationError, setOperationError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [externalQuantities, setExternalQuantities] = useState([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState("");
  const [externalDialog, setExternalDialog] = useState(null);
  const [externalDeleteItem, setExternalDeleteItem] = useState(null);
  const [externalSourceGroups, setExternalSourceGroups] = useState([]);
  const [externalSources, setExternalSources] = useState([]);
  const externalHistoryGroups = groupProductionExternalHistory(externalQuantities, selected?.operations ?? []);

  async function loadExternalQuantities(orderId = selected?.id) {
    if (!orderId) return;
    setExternalLoading(true);
    setExternalError("");
    try {
      const [items, summaries] = await Promise.all([
        api.get(`/api/production-external-quantities?orderId=${orderId}`),
        api.get(`/api/production-external-quantities/summary?orderId=${orderId}`),
      ]);
      setExternalQuantities(items);
      setExternalSourceGroups(summaries);
    } catch (requestError) {
      setExternalError(requestError.message || "Không thể tải lịch sử sản lượng ngoài.");
    } finally {
      setExternalLoading(false);
    }
  }

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
      setEditingOrder(false);
      setCleanupTarget(null);
      setOperationError("");
      setError("");
    }
    previousViewRef.current = view;
    load();
  }, [detailId, view]);

  useEffect(() => {
    api.get("/api/production-external-sources")
      .then(setExternalSources)
      .catch(() => setExternalSources([]));
  }, []);

  useEffect(() => {
    setExternalDialog(null);
    setExternalDeleteItem(null);
    setExternalQuantities([]);
    setExternalSourceGroups([]);
    if (selected?.id) loadExternalQuantities(selected.id);
  }, [selected?.id]);

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

  async function createOrder(orderDraft) {
    setSaving(true);
    setError("");
    try {
      const created = await api.post("/api/production-orders", buildProductionOrderPayload(orderDraft));
      setForm(emptyOrder());
      navigate(`/orders/${created.id}`);
    } catch (requestError) {
      setError(requestError.message || "Không thể tạo mã sản xuất.");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrder(orderDraft) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/production-orders/${selected.id}`, { ...orderDraft, plannedQuantity: Number(orderDraft.plannedQuantity), startDate: orderDraft.startDate || null, endDate: orderDraft.endDate || null });
      setEditingOrder(false);
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

  async function cleanupTargetOperation() {
    if (!selected) return;

    setSaving(true);
    setError("");
    try {
      await api.post("/api/production-orders/0417/operations/567/cleanup");
      setCleanupTarget(null);
      await load({ preserveDetail: true });
    } catch (requestError) {
      setError(requestError.message || "Không thể xóa công đoạn và dữ liệu liên quan.");
    } finally {
      setSaving(false);
    }
  }

  function openExternalDialog(operation, item = null) {
    setExternalError("");
    setExternalDialog({ operation, item });
  }

  async function submitExternalDialog(draft) {
    if (!selected || !externalDialog) return;
    setExternalLoading(true);
    setExternalError("");
    try {
      const payload = {
        receivedDate: draft.receivedDate,
        quantity: Number(draft.quantity),
        sourceName: draft.externalSourceId ? null : (draft.sourceName || null),
        externalSourceId: draft.externalSourceId || null,
        note: draft.note || null,
      };
      if (externalDialog.item) {
        await api.put(`/api/production-external-quantities/${externalDialog.item.id}`, payload);
      } else {
        await api.post("/api/production-external-quantities", {
          productionOrderId: selected.id,
          productionOperationId: externalDialog.operation.id,
          ...payload,
        });
      }
      setExternalDialog(null);
      await loadExternalQuantities(selected.id);
    } catch (requestError) {
      setExternalError(requestError.message || "Không thể ghi nhận sản lượng ngoài.");
    } finally {
      setExternalLoading(false);
    }
  }

  async function deleteExternalQuantity() {
    if (!externalDeleteItem) return;
    setExternalLoading(true);
    setExternalError("");
    try {
      await api.delete(`/api/production-external-quantities/${externalDeleteItem.id}`);
      setExternalDeleteItem(null);
      await loadExternalQuantities(selected?.id);
    } catch (requestError) {
      setExternalError(requestError.message || "Không thể xóa sản lượng ngoài.");
    } finally {
      setExternalLoading(false);
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

      {isCreateRoute && <div className="erp-section-description">Biểu mẫu tạo mã sản xuất đang mở trong popup.</div>}

      {isListRoute && <DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="Chưa có mã sản xuất." rowKey="id" onRowClick={(row) => navigate(`/orders/${row.id}`)} />}

      {detailId && <>
        {loading && <div className="erp-table-state">Đang tải chi tiết mã sản xuất...</div>}
        {!loading && !selected && <div className="erp-table-state">Không tìm thấy mã sản xuất.</div>}
        {selected && <>
          <FormSection title={`${selected.code} — ${selected.productName}`} description="Thông tin chung của Mã SX.">
            <div className="erp-field-wide erp-form-actions"><button type="button" className="erp-button erp-button-primary" onClick={() => { setEditingOrder(true); setError(""); }}>Sửa thông tin Mã SX</button></div>
          </FormSection>
          <FormSection title="Công đoạn" description="Tắt để giữ lịch sử. Có thể ghi nhận riêng sản lượng nhận từ bên ngoài.">
            <div className="erp-field-wide erp-table-wrap"><table className="erp-table"><thead><tr><th>Số CĐ</th><th>Tên</th><th>ĐVT</th><th>Giá cố định</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
              {selected.operations.map((item) => { const isCleanupTarget = selected.code === "0417" && item.operationNumber === 567; return <tr key={item.id}><td>CĐ{item.operationNumber}</td><td>{item.name}</td><td>{item.unit}</td><td>{formatFixedPrice(item.fixedPrice)}</td><td>{item.isActive ? "Hoạt động" : "Đã tắt"}</td><td><button type="button" className="erp-button erp-button-link" onClick={() => openExternalDialog(item)}>+ Bổ sung ngoài</button> <button type="button" className="erp-button erp-button-link" onClick={() => openDetailOperationDialog("edit", item)}>Sửa</button> <button type="button" className="erp-button erp-button-link" onClick={() => setOperationActive(item, !item.isActive)} disabled={saving}>{item.isActive ? "Tắt" : "Bật"}</button>{isCleanupTarget && <button type="button" className="erp-button erp-button-danger" onClick={() => setCleanupTarget(item)} disabled={saving}>Xóa dữ liệu CĐ567</button>}</td></tr>; })}
              {!selected.operations.length && <tr><td colSpan="6">Chưa có công đoạn.</td></tr>}
            </tbody></table></div>
            <div className="erp-field-wide erp-form-actions"><button type="button" className="erp-button erp-button-secondary" onClick={() => openDetailOperationDialog("create")}>+ Thêm công đoạn</button></div>
          </FormSection>
          {externalHistoryGroups.length > 0 && <FormSection title={`Chi tiết nhận ngoài (${externalQuantities.length} bản ghi)`} description="Các bản ghi được gom theo từng nguồn; mở từng nhóm khi cần sửa hoặc xóa.">
            <div className="erp-field-wide erp-production-external-history-groups">
              {externalHistoryGroups.map((group) => <details className="erp-production-external-history-group" key={group.key}>
                <summary><span className="erp-production-external-source">{group.sourceName}</span><span>{group.entries.length} bản ghi</span></summary>
                <div className="erp-production-external-history-group-body">
                  {group.entries.map((entry) => <div className="erp-production-external-history-row" key={entry.id}>
                    <div className="erp-production-external-history-meta"><strong>CĐ{entry.operation?.operationNumber ?? "?"}</strong><span>{entry.receivedDate}</span><strong>{Number(entry.quantity).toLocaleString("vi-VN")} {entry.operation?.unit || "cái"}</strong>{entry.note && <span>{entry.note}</span>}</div>
                    <div className="erp-production-external-history-actions"><button type="button" className="erp-button erp-button-link" onClick={() => entry.operation && openExternalDialog(entry.operation, entry)}>Sửa</button><button type="button" className="erp-button erp-button-link" onClick={() => setExternalDeleteItem(entry)}>Xóa</button></div>
                  </div>)}
                </div>
              </details>)}
            </div>
          </FormSection>}
          {externalSourceGroups.length > 0 && <FormSection title="Tổng hợp gia công ngoài" description="Cùng một người được gom chung; chi tiết từng công đoạn vẫn được giữ ở bảng phía trên.">
            <div className="erp-field-wide erp-table-wrap">
              <table className="erp-table erp-production-external-summary-table">
                <thead><tr><th>Người / nguồn</th><th>Công đoạn</th><th>Tổng</th></tr></thead>
                <tbody>
                  {externalSourceGroups.map((group) => (
                    <tr key={group.sourceName} className="erp-production-external-summary-row">
                      <th scope="row"><span className="erp-production-external-source">{group.sourceName}</span></th>
                      <td><div className="erp-production-external-operation-list">{group.operations.map((operation) => <span className="erp-production-external-operation-chip" key={`${operation.productionOperationId}-${operation.unit}`}>CĐ{operation.operationNumber}: {Number(operation.quantity).toLocaleString("vi-VN")} {operation.unit}</span>)}</div></td>
                      <td className="erp-production-external-total">{group.totalsByUnit.map((total) => <span key={total.unit}>{Number(total.quantity).toLocaleString("vi-VN")} {total.unit}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>}
        </>}
      </>}
      <ProductionOrderDialog
        mode="create"
        open={isCreateRoute}
        draft={form}
        loading={saving}
        error={error}
        onClose={() => navigate("/orders")}
        onChange={(next) => { setForm(next); setError(""); }}
        onSubmit={createOrder}
        onAddOperation={openCreateOperationDialog}
        onEditOperation={openCreateOperationEdit}
        onRemoveOperation={removeCreateOperation}
      />
      <ProductionOrderDialog
        mode="edit"
        open={Boolean(editingOrder && selected)}
        draft={detail}
        loading={saving}
        error={error}
        onClose={() => setEditingOrder(false)}
        onChange={(next) => { setDetail(next); setError(""); }}
        onSubmit={updateOrder}
      />
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
      <ProductionExternalQuantityDialog
        open={Boolean(externalDialog)}
        order={selected}
        operation={externalDialog?.operation}
        item={externalDialog?.item}
        externalSources={externalSources}
        loading={externalLoading}
        error={externalError}
        onClose={() => !externalLoading && setExternalDialog(null)}
        onChange={() => setExternalError("")}
        onSubmit={submitExternalDialog}
      />
      <ConfirmDialog
        open={Boolean(cleanupTarget)}
        title="Xác nhận xóa dữ liệu CĐ567?"
        confirmLabel="Xóa dữ liệu CĐ567"
        loading={saving}
        onClose={() => !saving && setCleanupTarget(null)}
        onConfirm={cleanupTargetOperation}
      >
        Toàn bộ dữ liệu sản lượng của CĐ567 thuộc Mã SX 0417 sẽ bị xóa.
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(externalDeleteItem)}
        title="Xóa sản lượng nhận ngoài?"
        loading={externalLoading}
        onClose={() => !externalLoading && setExternalDeleteItem(null)}
        onConfirm={deleteExternalQuantity}
      >
        Bản ghi này sẽ bị xóa khỏi lịch sử nhận ngoài. Sản lượng nội bộ không bị ảnh hưởng.
      </ConfirmDialog>
    </div>
  );
}
