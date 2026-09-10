import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { ProductionExternalSourceDialog } from "./ProductionExternalSourceDialog.jsx";

export function ProductionExternalSourceConfigPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setSources(await api.get("/api/production-external-sources?includeInactive=true"));
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Không thể tải danh sách gia công ngoài.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitSource(payload) {
    setSaving(true);
    setError("");
    try {
      if (dialog.source) await api.put(`/api/production-external-sources/${dialog.source.id}`, payload);
      else await api.post("/api/production-external-sources", { name: payload.name });
      setDialog(null);
      await load();
    } catch (requestError) {
      setError(requestError.message || "Không thể lưu nguồn gia công ngoài.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSource(source) {
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/production-external-sources/${source.id}`, { name: source.name, isActive: !source.isActive });
      await load();
    } catch (requestError) {
      setError(requestError.message || "Không thể cập nhật trạng thái nguồn gia công ngoài.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="erp-feature-page">
      <PageHeader title="Danh sách gia công ngoài" description="Cấu hình nguồn để chọn nhanh khi nhập sản lượng nhận ngoài." actions={<button type="button" className="erp-button erp-button-primary" onClick={() => { setError(""); setDialog({ source: null }); }}>+ Thêm nguồn gia công</button>} />
      {error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}
      <FormSection title="Nguồn gia công ngoài" description="Nguồn đã tắt không xuất hiện trong dropdown nhập mới; dữ liệu lịch sử vẫn được giữ nguyên.">
        <div className="erp-field-wide erp-section-description">Trạng thái: Đang dùng / Tắt.</div>
        <div className="erp-field-wide erp-table-wrap">
          <table className="erp-table">
            <thead><tr><th>Tên nguồn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="3">Đang tải...</td></tr>}
              {!loading && sources.length === 0 && <tr><td colSpan="3">Chưa có nguồn gia công.</td></tr>}
              {!loading && sources.map((source) => <tr key={source.id}>
                <td><strong>{source.name}</strong></td>
                <td>{source.isActive ? "Đang dùng" : "Đã tắt"}</td>
                <td><div className="erp-table-actions"><button type="button" className="erp-button erp-button-secondary" onClick={() => { setError(""); setDialog({ source }); }}>Sửa</button><button type="button" className="erp-button erp-button-link" disabled={saving} onClick={() => toggleSource(source)}>{source.isActive ? "Tắt" : "Bật lại"}</button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </FormSection>
      <ProductionExternalSourceDialog open={Boolean(dialog)} source={dialog?.source} loading={saving} error={error} onClose={() => !saving && setDialog(null)} onSubmit={submitSource} onChange={() => setError("")} />
    </div>
  );
}
