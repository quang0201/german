import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { isVersionConflict, mapProductionEntryError } from "./productionEntryErrors.js";
import { buildQuickEntryPayload, canWriteQuickEntry, createQuickEntry, isQuickEntryDetailCompatible, quickEntryExpectedVersion, shouldShowQuickEntryReload } from "./productionMatrixQuickEntry.js";
import { calculateHourSplitPreview, resolveQuickEntryQuantities } from "./productionMatrixHourSplit.js";
import "./ProductionMatrixDialogs.css";

const DIRECT_MODE = "direct";
const HOUR_SPLIT_MODE = "hour-split";
const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function ProductionMatrixQuickEntryDialog({ context, onClose, onSaved, onReload }) {
  const record = context?.cell?.entryCount === 1 ? context.cell.records?.[0] : null;
  const editing = record?.entryMode === "Direct";
  const [inputMode, setInputMode] = useState(DIRECT_MODE);
  const [directHc, setDirectHc] = useState("");
  const [directTc, setDirectTc] = useState("");
  const [hcHours, setHcHours] = useState("");
  const [tcHours, setTcHours] = useState("");
  const [totalExpression, setTotalExpression] = useState("");
  const [note, setNote] = useState("");
  const [editEntry, setEditEntry] = useState(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!context) return undefined;
    let active = true;
    setInputMode(DIRECT_MODE);
    setDirectHc(editing ? String(context.cell.hcQuantity ?? "") : "");
    setDirectTc(editing ? String(context.cell.tcQuantity ?? "") : "");
    setHcHours("");
    setTcHours("");
    setTotalExpression("");
    setNote(editing ? (record?.note ?? "") : "");
    setEditEntry(null);
    setError("");
    setConflict(false);
    setDetailLoaded(!editing);
    setConfirmDelete(false);
    if (!editing) return () => { active = false; };

    setLoadingEntry(true);
    api.get(`/api/production-entries/${record.id}`)
      .then((entry) => {
        if (!active) return;
        if (!isQuickEntryDetailCompatible({ record, context, detail: entry })) {
          setEditEntry(null);
          setDetailLoaded(false);
          setConflict(true);
          setError("Dữ liệu trên ma trận đã thay đổi. Hãy tải lại trước khi sửa.");
          return;
        }
        setEditEntry(entry);
        setDetailLoaded(true);
        setDirectHc(String(entry.directHcQuantity ?? entry.hcQuantity ?? ""));
        setDirectTc(String(entry.directTcQuantity ?? entry.tcQuantity ?? ""));
        setNote(entry.note ?? "");
      })
      .catch((requestError) => active && setError(mapProductionEntryError(requestError, "Không thể tải bản ghi để chỉnh sửa.")))
      .finally(() => active && setLoadingEntry(false));
    return () => { active = false; };
  }, [context, editing, record?.id, record?.note]);

  const splitPreview = useMemo(() => {
    if (inputMode !== HOUR_SPLIT_MODE) return null;
    try {
      return { value: calculateHourSplitPreview({ hcHours, tcHours, totalExpression }), error: "" };
    } catch (validationError) {
      return { value: null, error: validationError.message };
    }
  }, [hcHours, inputMode, tcHours, totalExpression]);
  if (!context) return null;

  const activeQuantities = inputMode === HOUR_SPLIT_MODE && splitPreview?.value
    ? splitPreview.value
    : { hc: directHc === "" ? null : Number(directHc), tc: directTc === "" ? null : Number(directTc) };
  const payload = buildQuickEntryPayload({ context, quantities: activeQuantities, editEntry, note });

  async function save() {
    let quantities;
    try {
      quantities = resolveQuickEntryQuantities({
        mode: inputMode,
        directHcQuantity: directHc,
        directTcQuantity: directTc,
        hcHours,
        tcHours,
        totalExpression,
      });
    } catch (validationError) {
      setError(validationError.message);
      return;
    }
    const savePayload = { ...payload, directHcQuantity: quantities.hc, directTcQuantity: quantities.tc };
    setSaving(true); setError(""); setConflict(false);
    try {
      if (editing) await api.put(`/api/production-entries/${record.id}`, { ...savePayload, version: quickEntryExpectedVersion(record) });
      else await createQuickEntry(savePayload);
      onSaved?.();
    } catch (requestError) {
      setConflict(isVersionConflict(requestError));
      setError(mapProductionEntryError(requestError, "Không thể lưu sản lượng."));
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true); setError(""); setConflict(false);
    try {
      await api.delete(`/api/production-entries/${record.id}?version=${quickEntryExpectedVersion(record)}`);
      onSaved?.();
    } catch (requestError) {
      setConflict(isVersionConflict(requestError));
      setError(mapProductionEntryError(requestError, "Không thể xóa sản lượng."));
    } finally { setSaving(false); }
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-matrix-dialog" role="dialog" aria-modal="true" aria-labelledby="matrix-quick-title">
        <h2 id="matrix-quick-title">{editing ? "Chỉnh sửa sản lượng" : "Nhập sản lượng"}</h2>
        <div className="erp-dialog-body">
          <div className="erp-matrix-readonly-grid">
            <div><span>Nhân viên</span><strong>{context.employee.employeeName}</strong></div>
            <div><span>Mã SX</span><strong>{context.order.orderCode}</strong></div>
            <div><span>Công đoạn</span><strong>CĐ{context.operation.operationNumber}</strong></div>
            <div><span>Ngày</span><strong>{context.workDate.split("-").reverse().join("/")}</strong></div>
          </div>
          <div className="erp-mode-grid" role="group" aria-label="Kiểu nhập nhanh">
            <button type="button" className={`erp-mode-option ${inputMode === DIRECT_MODE ? "is-selected" : ""}`} aria-pressed={inputMode === DIRECT_MODE} onClick={() => { setInputMode(DIRECT_MODE); setError(""); }}>
              <strong>Nhập trực tiếp</strong><span>Nhập riêng số lượng HC và TC.</span>
            </button>
            <button type="button" className={`erp-mode-option ${inputMode === HOUR_SPLIT_MODE ? "is-selected" : ""}`} aria-pressed={inputMode === HOUR_SPLIT_MODE} onClick={() => { setInputMode(HOUR_SPLIT_MODE); setError(""); }}>
              <strong>Chia đều theo giờ</strong><span>Phân bổ tổng sản lượng theo số giờ HC/TC.</span>
            </button>
          </div>
          {inputMode === DIRECT_MODE ? <div className="erp-matrix-input-grid">
            <label><span>HC</span><input className="erp-control" type="number" min="0" required value={directHc} onChange={(event) => { setDirectHc(event.target.value); setError(""); }} /></label>
            <label><span>TC</span><input className="erp-control" type="number" min="0" required value={directTc} onChange={(event) => { setDirectTc(event.target.value); setError(""); }} /></label>
            <label className="erp-matrix-field-wide"><span>Ghi chú</span><input className="erp-control" value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </div> : <>
            <div className="erp-matrix-input-grid">
              <label><span>Giờ HC</span><input className="erp-control" type="number" min="0" step="any" value={hcHours} onChange={(event) => { setHcHours(event.target.value); setError(""); }} /></label>
              <label><span>Giờ TC</span><input className="erp-control" type="number" min="0" step="any" value={tcHours} onChange={(event) => { setTcHours(event.target.value); setError(""); }} /></label>
              <label className="erp-matrix-field-wide"><span>Tổng sản lượng</span><input className="erp-control" inputMode="decimal" placeholder="Ví dụ: 300+100" value={totalExpression} onChange={(event) => { setTotalExpression(event.target.value); setError(""); }} /></label>
              <label className="erp-matrix-field-wide"><span>Ghi chú</span><input className="erp-control" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            </div>
            {splitPreview?.value && <div className="erp-matrix-readonly-grid erp-matrix-preview-grid">
              <div><span>Tổng sản lượng</span><strong>{quantityFormat.format(splitPreview.value.total)}</strong></div>
              <div><span>Tổng giờ</span><strong>{quantityFormat.format(splitPreview.value.totalHours)}</strong></div>
              <div><span>Sản lượng / giờ</span><strong>{quantityFormat.format(splitPreview.value.quantityPerHour)}</strong></div>
              <div><span>HC dự kiến</span><strong>{quantityFormat.format(splitPreview.value.hc)}</strong></div>
              <div><span>TC dự kiến</span><strong>{quantityFormat.format(splitPreview.value.tc)}</strong></div>
            </div>}
          </>}
          {loadingEntry && <p className="erp-inline-message">Đang tải dữ liệu gốc...</p>}
          {(error || splitPreview?.error) && <div className="erp-inline-message erp-inline-error" role="alert"><span>{error || splitPreview.error}</span>{shouldShowQuickEntryReload({ editing, loadingEntry, detailLoaded, conflict }) && <button type="button" className="erp-button erp-button-secondary" onClick={onReload}>Tải lại dữ liệu</button>}</div>}
          {confirmDelete && <p className="erp-inline-message erp-inline-error">Bấm Xóa lần nữa để xác nhận.</p>}
        </div>
        <div className="erp-dialog-actions erp-matrix-dialog-actions">
          {editing && <button type="button" className="erp-button erp-button-danger" disabled={!canWriteQuickEntry({ editing, detailLoaded, saving, conflict }) || loadingEntry} onClick={remove}>Xóa</button>}
          <span className="erp-matrix-action-spacer" />
          <button type="button" className="erp-button erp-button-secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="erp-button erp-button-primary" disabled={!canWriteQuickEntry({ editing, detailLoaded, saving, conflict }) || loadingEntry} onClick={save}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </section>
    </div>
  );
}
