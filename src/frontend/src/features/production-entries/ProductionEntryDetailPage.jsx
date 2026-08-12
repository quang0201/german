import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { ConfirmDialog } from "../../components/erp/ConfirmDialog.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FormSection } from "../../components/erp/FormSection.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { ProductionEntryFormPage } from "./ProductionEntryFormPage.jsx";
import { isVersionConflict, mapProductionEntryError } from "./productionEntryErrors.js";
import { entryModeLabel } from "../../lib/i18n.js";

export function ProductionEntryDetailPage({ session, params, entryId, onChanged, onClose, inPanel = false }) {
  const id = entryId ?? params?.id;
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const canMutate = session?.role === "Manager" || session?.role === "Admin";

  function load() {
    setLoading(true);
    setError("");
    setConflict(false);
    setEditing(false);
    api.get(`/api/production-entries/${id}`)
      .then(setEntry)
      .catch((requestError) => setError(mapProductionEntryError(requestError, "Không thể tải chi tiết sản lượng.")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function remove() {
    setDeleting(true);
    try {
      await api.delete(`/api/production-entries/${id}?version=${encodeURIComponent(entry.version)}`);
      toast.success("Đã xóa sản lượng.");
      setConfirmingDelete(false);
      onChanged?.({ type: "delete", id });
      onClose?.();
    } catch (requestError) {
      setConflict(isVersionConflict(requestError));
      setError(mapProductionEntryError(requestError, "Không thể xóa sản lượng."));
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="erp-state">Đang tải chi tiết...</div>;
  if (error && !entry) return <Alert variant="error" title="Không thể tải dữ liệu."><span>{error}</span></Alert>;
  if (!entry) return null;

  if (editing) {
    return <ProductionEntryFormPage session={session} entry={entry} inPanel={inPanel} onCancel={() => setEditing(false)} onSaved={(saved) => { setEntry((current) => ({ ...current, ...saved })); setEditing(false); onChanged?.({ type: "edit", entry: saved }); }} />;
  }

  const actions = canMutate && <><button type="button" className="erp-button erp-button-secondary" onClick={() => setEditing(true)}>Sửa</button><button type="button" className="erp-button erp-button-danger" onClick={() => setConfirmingDelete(true)}>Xóa</button></>;
  return (
    <div className="erp-detail-page">
      {!inPanel && <PageHeader title="Chi tiết sản lượng" description={`Phiên bản ${entry.version}`} actions={actions} />}
      {inPanel && <div className="erp-detail-actions">{actions}</div>}
      {error && <Alert variant={conflict ? "warning" : "error"} title={conflict ? "Xung đột phiên bản" : "Không thể hoàn tất thao tác."} action={conflict ? <button type="button" className="erp-button erp-button-secondary" onClick={load}>Tải lại dữ liệu</button> : undefined}>{error}</Alert>}
      <FormSection title="Thông tin chung">
        <ReadField label="Ngày" value={entry.workDate} />
        <ReadField label="Nhân viên" value={`${entry.employeeCode} — ${entry.employeeName}`} />
        <ReadField label="Mã sản xuất" value={`${entry.productionOrderCode} — ${entry.productName}`} />
        <ReadField label="Công đoạn" value={`CĐ${entry.operationNumber} — ${entry.operationName} (${entry.unit})`} />
      </FormSection>
      <FormSection title="Sản lượng">
        <ReadField label="Chế độ" value={entryModeLabel(entry.entryMode)} />
        <ReadField label="HC" value={entry.hcQuantity} />
        <ReadField label="TC" value={entry.tcQuantity} />
        <ReadField label="Tổng" value={entry.totalQuantity} />
        <ReadField label="Ca 1" value={entry.shift1Quantity ?? "—"} />
        <ReadField label="Ca 2" value={entry.shift2Quantity ?? "—"} />
        <ReadField label="Giờ tăng ca" value={entry.overtimeHours ?? "—"} />
        <ReadField label="Sản lượng TC thực tế" value={entry.overtimeQuantity ?? "—"} />
      </FormSection>
      <FormSection title="Thông tin hệ thống">
        <ReadField label="Người nhập" value={`${entry.submittedByUsername}${entry.submittedByEmployeeName ? ` — ${entry.submittedByEmployeeName}` : ""}`} />
        <ReadField label="Tạo lúc" value={formatDateTime(entry.createdAt)} />
        <ReadField label="Cập nhật lúc" value={formatDateTime(entry.updatedAt)} />
        <ReadField label="Ghi chú" value={entry.note || "—"} wide />
      </FormSection>
      <ConfirmDialog open={confirmingDelete} title="Xóa sản lượng?" confirmLabel="Xóa sản lượng" loading={deleting} onClose={() => setConfirmingDelete(false)} onConfirm={remove}>Bản ghi sẽ được xóa mềm và không còn xuất hiện trong danh sách thông thường.</ConfirmDialog>
    </div>
  );
}

function ReadField({ label, value, wide = false }) {
  return <Field label={label} wide={wide}><div className="erp-readonly-field">{value}</div></Field>;
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}
