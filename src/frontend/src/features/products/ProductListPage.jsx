import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { ConfirmDialog } from "../../components/erp/ConfirmDialog.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Icon } from "../../components/erp/Icon.jsx";
import { ListToolbar } from "../../components/erp/ListToolbar.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { ProductDialog } from "./ProductDialog.jsx";
import { buildProductPayload, emptyProduct, productForm } from "./productForm.js";

export function ProductListPage() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.get("/api/products"));
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Không thể tải danh sách sản phẩm.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(draft) {
    setSaving(true);
    setError("");
    try {
      const payload = buildProductPayload(draft);
      if (dialog.product) await api.put(`/api/products/${dialog.product.id}`, payload);
      else await api.post("/api/products", payload);
      api.invalidateCache("/api/products");
      setDialog(null);
      await load();
    } catch (requestError) {
      setError(requestError.message || "Không thể lưu sản phẩm.");
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    if (!disableTarget) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/api/products/${disableTarget.id}`);
      api.invalidateCache("/api/products");
      setDisableTarget(null);
      await load();
    } catch (requestError) {
      setError(requestError.message || "Không thể tắt sản phẩm.");
    } finally {
      setSaving(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const visibleRows = needle ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(needle)) : rows;
  const columns = [
    { key: "code", label: "Mã sản phẩm" },
    { key: "name", label: "Tên sản phẩm" },
    { key: "operationCount", label: "Công đoạn mẫu" },
    { key: "orderCount", label: "Mã sản xuất" },
    { key: "isActive", label: "Trạng thái", render: (row) => (row.isActive ? "Đang dùng" : "Đã tắt") },
    { key: "action", label: "Thao tác", render: (row) => (
      <div className="erp-table-actions">
        <button type="button" className="erp-button erp-button-secondary erp-button-small" onClick={(event) => { event.stopPropagation(); setError(""); setDialog({ product: row }); }}>Sửa</button>
        {row.isActive && <button type="button" className="erp-button erp-button-link" onClick={(event) => { event.stopPropagation(); setDisableTarget(row); }}>Tắt</button>}
      </div>
    ) },
  ];

  return (
    <div className="erp-feature-page">
      <PageHeader title="Sản phẩm" description="Khuôn mẫu công đoạn: mã sản xuất chọn sản phẩm sẽ sao chép danh sách công đoạn mẫu." actions={<button type="button" className="erp-button erp-button-primary" onClick={() => { setError(""); setDialog({ product: null }); }}><Icon name="plus" size={17} />Thêm sản phẩm</button>} />
      {error && !dialog && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}
      <ListToolbar query={query} onQueryChange={setQuery} shown={visibleRows.length} total={rows.length} noun="sản phẩm" placeholder="Tìm theo mã hoặc tên sản phẩm..." />
      <DataTable columns={columns} rows={visibleRows} loading={loading} error={error} emptyMessage="Chưa có sản phẩm." rowKey="id" onRowClick={(row) => { setError(""); setDialog({ product: row }); }} />
      <ProductDialog
        open={Boolean(dialog)}
        mode={dialog?.product ? "edit" : "create"}
        draft={dialog?.draft ?? (dialog?.product ? productForm(dialog.product) : emptyProduct())}
        loading={saving}
        error={error}
        onClose={() => !saving && setDialog(null)}
        onChange={(next) => { setDialog((current) => ({ ...current, draft: next })); setError(""); }}
        onSubmit={submit}
      />
      <ConfirmDialog open={Boolean(disableTarget)} title="Tắt sản phẩm?" confirmLabel="Tắt sản phẩm" loading={saving} onClose={() => !saving && setDisableTarget(null)} onConfirm={disable}>
        Sản phẩm không còn xuất hiện khi tạo mã sản xuất mới. Các mã sản xuất đã gắn vẫn được giữ nguyên.
      </ConfirmDialog>
    </div>
  );
}
