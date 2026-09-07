import React from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { formatFixedPrice } from "./productionOrderForm.js";
import { orderStatusLabel } from "../../lib/i18n.js";

const STATUSES = ["Draft", "InProduction", "Completed", "Cancelled"];

export function ProductionOrderDialog({ open = false, mode = "create", draft = {}, loading = false, error = "", onClose, onSubmit, onChange, onAddOperation, onEditOperation, onRemoveOperation }) {
  if (!open) return null;

  const editing = mode === "edit";
  const update = (key, value) => onChange?.({ ...draft, [key]: value });

  function submit(event) {
    event.preventDefault();
    onSubmit?.(draft);
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-production-order-dialog" role="dialog" aria-modal="true" aria-labelledby="production-order-dialog-title">
        <div className="erp-production-order-dialog-header">
          <h2 id="production-order-dialog-title">{editing ? "Sửa mã sản xuất" : "Tạo mã sản xuất"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể lưu mã sản xuất.">{error}</Alert>}
        <form onSubmit={submit}>
          <div className="erp-production-order-dialog-fields">
            <Field label="Mã SX" required><input className="erp-control" required value={draft.code ?? ""} onChange={(event) => update("code", event.target.value)} /></Field>
            <Field label="Sản phẩm" required><input className="erp-control" required value={draft.productName ?? ""} onChange={(event) => update("productName", event.target.value)} /></Field>
            <Field label="Số lượng kế hoạch" required><input className="erp-control" required min="0" step="0.01" type="number" value={draft.plannedQuantity ?? ""} onChange={(event) => update("plannedQuantity", event.target.value)} /></Field>
            <Field label="Trạng thái"><select className="erp-control" value={draft.status ?? "Draft"} onChange={(event) => update("status", event.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{orderStatusLabel(status)}</option>)}</select></Field>
            <Field label="Ngày bắt đầu"><input className="erp-control" type="date" value={draft.startDate ?? ""} onChange={(event) => update("startDate", event.target.value)} /></Field>
            <Field label="Ngày kết thúc"><input className="erp-control" type="date" value={draft.endDate ?? ""} onChange={(event) => update("endDate", event.target.value)} /></Field>
            {!editing && <div className="erp-field-wide">
              <div className="erp-section-heading"><div><strong>Công đoạn</strong><p className="erp-section-description">Thêm hoặc sửa công đoạn bằng popup trước khi tạo mã sản xuất.</p></div><button type="button" className="erp-button erp-button-secondary" onClick={onAddOperation} disabled={loading}>+ Thêm công đoạn</button></div>
              <div className="erp-table-wrap"><table className="erp-table"><thead><tr><th>Số CĐ</th><th>Tên</th><th>ĐVT</th><th>Giá cố định</th><th>Thao tác</th></tr></thead><tbody>
                {(draft.operations ?? []).map((operation, index) => <tr key={index}><td>CĐ{operation.operationNumber}</td><td>{operation.name}</td><td>{operation.unit}</td><td>{formatFixedPrice(operation.fixedPrice)}</td><td><button type="button" className="erp-button erp-button-link" onClick={() => onEditOperation?.(index, operation)} disabled={loading}>Sửa</button> <button type="button" className="erp-button erp-button-link" onClick={() => onRemoveOperation?.(index)} disabled={loading}>Xóa</button></td></tr>)}
                {!(draft.operations ?? []).length && <tr><td colSpan="5">Chưa có công đoạn.</td></tr>}
              </tbody></table></div>
            </div>}
          </div>
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo mã sản xuất"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
