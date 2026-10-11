import React from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { useEscapeKey } from "../../lib/useEscapeKey.js";
import { emptyTemplateOperation } from "./productForm.js";

export function ProductDialog({ open = false, mode = "create", draft = {}, loading = false, error = "", onClose, onChange, onSubmit }) {
  useEscapeKey(open, onClose, loading);
  if (!open) return null;

  const editing = mode === "edit";
  const operations = draft.operations ?? [];
  const update = (key, value) => onChange?.({ ...draft, [key]: value });
  const updateOperation = (index, key, value) =>
    update("operations", operations.map((operation, itemIndex) => (itemIndex === index ? { ...operation, [key]: value } : operation)));

  function submit(event) {
    event.preventDefault();
    onSubmit?.(draft);
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-production-order-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <div className="erp-production-order-dialog-header">
          <h2 id="product-dialog-title">{editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h2>
          <button type="button" className="erp-icon-button" aria-label="Đóng" onClick={onClose} disabled={loading}>×</button>
        </div>
        {error && <Alert variant="error" title="Không thể lưu sản phẩm.">{error}</Alert>}
        <form onSubmit={submit}>
          <div className="erp-production-order-dialog-fields">
            <Field label="Mã sản phẩm" required hint="Ví dụ 4004"><input className="erp-control" required value={draft.code ?? ""} onChange={(event) => update("code", event.target.value)} /></Field>
            <Field label="Tên sản phẩm" required><input className="erp-control" required value={draft.name ?? ""} onChange={(event) => update("name", event.target.value)} /></Field>
            <div className="erp-field-wide">
              <div className="erp-section-heading">
                <div><strong>Công đoạn mẫu</strong><p className="erp-section-description">Mã sản xuất mới chọn sản phẩm này sẽ sao chép danh sách này. Sửa mẫu không đổi các mã đã tạo.</p></div>
                <button type="button" className="erp-button erp-button-secondary" onClick={() => update("operations", [...operations, emptyTemplateOperation()])} disabled={loading}>+ Thêm công đoạn</button>
              </div>
              <div className="erp-table-wrap"><table className="erp-table"><thead><tr><th>Số CĐ</th><th>Tên</th><th>ĐVT</th><th>Giá cố định</th><th>Dùng</th><th aria-label="Thao tác" /></tr></thead><tbody>
                {operations.map((operation, index) => <tr key={index}>
                  <td><input className="erp-control" aria-label={`Số CĐ dòng ${index + 1}`} required min="1" type="number" value={operation.operationNumber} onChange={(event) => updateOperation(index, "operationNumber", event.target.value)} /></td>
                  <td><input className="erp-control" aria-label={`Tên CĐ dòng ${index + 1}`} required value={operation.name} onChange={(event) => updateOperation(index, "name", event.target.value)} /></td>
                  <td><input className="erp-control" aria-label={`ĐVT dòng ${index + 1}`} required value={operation.unit} onChange={(event) => updateOperation(index, "unit", event.target.value)} /></td>
                  <td><input className="erp-control" aria-label={`Giá cố định dòng ${index + 1}`} min="0" step="0.01" type="number" value={operation.fixedPrice} onChange={(event) => updateOperation(index, "fixedPrice", event.target.value)} /></td>
                  <td><input type="checkbox" aria-label={`Dùng dòng ${index + 1}`} checked={operation.isActive !== false} onChange={(event) => updateOperation(index, "isActive", event.target.checked)} /></td>
                  <td><button type="button" className="erp-button erp-button-link erp-button-link-danger" onClick={() => update("operations", operations.filter((_, itemIndex) => itemIndex !== index))} disabled={loading}>Xóa</button></td>
                </tr>)}
                {!operations.length && <tr><td colSpan="6">Chưa có công đoạn mẫu.</td></tr>}
              </tbody></table></div>
            </div>
          </div>
          <div className="erp-dialog-actions">
            <button type="button" className="erp-button erp-button-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="erp-button erp-button-primary" disabled={loading}>{loading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm sản phẩm"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
