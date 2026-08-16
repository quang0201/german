import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { AttendanceMonthlyMatrix } from "./AttendanceMonthlyMatrix.jsx";
import {
  attendanceBlockKey,
  attendanceDayBlocks,
  attendanceDayKey,
  buildAttendanceDrafts,
  buildAttendanceRenderData,
  buildAttendanceSaveData,
  emptyAttendanceCache,
  isCurrentAttendanceRequest,
  mergeAttendanceCache,
  mergeAttendanceSaveDrafts,
  mergeDraftsPreservingDirty,
  patchAttendanceSave,
  setAttendanceBlockStatus,
  buildAttendanceSavePayload,
  currentAttendanceMonth,
  shiftAttendanceMonth,
} from "./attendanceModel.js";
import "./AttendanceMonthlyMatrix.css";

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

export function AttendancePage() {
  const [monthKey, setMonthKey] = useState(() => currentAttendanceMonth());
  const [cache, setCache] = useState(() => emptyAttendanceCache(currentAttendanceMonth(), 0));
  const [renderedBlockStarts, setRenderedBlockStarts] = useState([1]);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dirtyDayKeys, setDirtyDayKeys] = useState(() => new Set());
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollLeftRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const monthGenerationRef = useRef(0);
  const activeBlockIndexRef = useRef(0);
  const requestKeysRef = useRef(new Set());
  const dirtyDayKeysRef = useRef(new Set());
  const dayRevisionsRef = useRef({});

  const yearMonth = monthKey.split("-").map(Number);
  const blocks = attendanceDayBlocks(yearMonth[0], yearMonth[1]);

  useEffect(() => {
    const generation = monthGenerationRef.current + 1;
    monthGenerationRef.current = generation;
    activeBlockIndexRef.current = 0;
    requestKeysRef.current = new Set();
    loadingMoreRef.current = false;
    dirtyDayKeysRef.current = new Set();
    dayRevisionsRef.current = {};
    setActiveBlockIndex(0);
    setRenderedBlockStarts([1]);
    setLoadingMore(false);
    setSaving(false);
    setLoading(true);
    setError("");
    setCache(emptyAttendanceCache(monthKey, generation));
    setDrafts({});
    setDirtyDayKeys(new Set());
    const [year, month] = monthKey.split("-");
    api.get(`/api/attendance/monthly?year=${year}&month=${month}&employeeLimit=20&dayFrom=1&dayCount=10`)
      .then((payload) => {
        if (!isCurrentAttendanceRequest(monthKey, monthKey, generation, monthGenerationRef.current)) return;
        setCache(mergeAttendanceCache(emptyAttendanceCache(monthKey, generation), payload, { batchId: "batch-0" }));
        setDrafts(buildAttendanceDrafts(payload));
      })
      .catch((requestError) => {
        if (generation === monthGenerationRef.current) setError(requestError.message || "Không thể tải dữ liệu chấm công.");
      })
      .finally(() => {
        if (generation === monthGenerationRef.current) setLoading(false);
      });
  }, [monthKey]);

  const data = useMemo(() => buildAttendanceRenderData(cache, monthKey, renderedBlockStarts), [cache, monthKey, renderedBlockStarts]);
  const saveData = useMemo(() => buildAttendanceSaveData(cache), [cache]);
  const activeBlock = blocks[activeBlockIndex];
  const visibleData = useMemo(() => ({
    ...data,
    activeBlockStartDate: activeBlock ? `${monthKey}-${String(activeBlock.dayFrom).padStart(2, "0")}` : null,
    activeBlockEndDate: activeBlock ? `${monthKey}-${String(activeBlock.dayTo).padStart(2, "0")}` : null,
    employees: employeeId ? data.employees.filter((employee) => employee.employeeId === employeeId) : data.employees,
  }), [activeBlock, data, employeeId, monthKey]);

  function updateDirty(key, updater) {
    setDirtyDayKeys((previous) => {
      const next = updater(previous);
      dirtyDayKeysRef.current = next;
      return next;
    });
  }

  async function loadBlock(batch, block, retry = false) {
    const blockKey = attendanceBlockKey(cache.generation, batch.id, block.dayFrom);
    const existing = cache.blocks[blockKey];
    if (requestKeysRef.current.has(blockKey) || existing?.status === "loaded" || (existing?.status === "error" && !retry)) return;
    requestKeysRef.current.add(blockKey);
    setCache((current) => setAttendanceBlockStatus(current, blockKey, "loading", "", { batchId: batch.id, dayFrom: block.dayFrom }));
    const requestedMonthKey = monthKey;
    const requestedGeneration = cache.generation;
    const [year, month] = monthKey.split("-");
    const params = new URLSearchParams({ year, month, employeeLimit: "20", dayFrom: String(block.dayFrom), dayCount: String(block.dayCount) });
    if (batch.inputCursor) params.set("employeeCursor", batch.inputCursor);
    try {
      const payload = await api.get(`/api/attendance/monthly?${params}`);
      if (!isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) return;
      setCache((current) => mergeAttendanceCache(current, payload, { batchId: batch.id, inputCursor: batch.inputCursor }));
      setDrafts((current) => mergeDraftsPreservingDirty(current, payload, dirtyDayKeysRef.current));
    } catch (requestError) {
      if (isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) {
        setCache((current) => setAttendanceBlockStatus(current, blockKey, "error", requestError.message || "Không thể tải block ngày.", { batchId: batch.id, dayFrom: block.dayFrom }));
      }
    } finally {
      requestKeysRef.current.delete(blockKey);
    }
  }

  useEffect(() => {
    if (loading) return;
    const renderedBlocks = blocks.filter((block) => renderedBlockStarts.includes(block.dayFrom));
    for (const batch of cache.batches) {
      for (const block of renderedBlocks) {
        const blockKey = attendanceBlockKey(cache.generation, batch.id, block.dayFrom);
        const status = cache.blocks[blockKey]?.status ?? "idle";
        if (status === "idle") loadBlock(batch, block);
      }
    }
  }, [cache.batches.length, cache.generation, loading, renderedBlockStarts.join(",")]);

  async function loadMoreEmployees() {
    const activeBlock = blocks[activeBlockIndexRef.current];
    const lastBatch = cache.batches.at(-1);
    if (!activeBlock || !lastBatch?.nextCursor || loadingMoreRef.current) return;
    const requestKey = `employee|${cache.generation}|${lastBatch.nextCursor}|${activeBlock.dayFrom}`;
    if (requestKeysRef.current.has(requestKey)) return;
    requestKeysRef.current.add(requestKey);
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const requestedMonthKey = monthKey;
    const requestedGeneration = cache.generation;
    const [year, month] = monthKey.split("-");
    const params = new URLSearchParams({ year, month, employeeCursor: lastBatch.nextCursor, employeeLimit: "20", dayFrom: String(activeBlock.dayFrom), dayCount: String(activeBlock.dayCount) });
    try {
      const payload = await api.get(`/api/attendance/monthly?${params}`);
      if (!isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) return;
      const batchId = `batch-${cache.batches.length}`;
      setCache((current) => mergeAttendanceCache(current, payload, { batchId, inputCursor: lastBatch.nextCursor }));
      setDrafts((current) => mergeDraftsPreservingDirty(current, payload, dirtyDayKeysRef.current));
    } catch (requestError) {
      if (isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) setError(requestError.message || "Không thể tải thêm nhân viên.");
    } finally {
      requestKeysRef.current.delete(requestKey);
      if (isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  function requestBlockForAllBatches(block) {
    for (const batch of cache.batches) loadBlock(batch, block);
  }

  function showNextBlock() {
    const currentIndex = activeBlockIndexRef.current;
    const nextIndex = currentIndex + 1;
    if (!blocks[nextIndex]) return;
    const current = blocks[currentIndex];
    const next = blocks[nextIndex];
    if (!renderedBlockStarts.includes(next.dayFrom)) {
      setRenderedBlockStarts([current.dayFrom, next.dayFrom]);
      requestBlockForAllBatches(next);
      return;
    }
    const nextLoaded = cache.batches.length > 0 && cache.batches.every((batch) => cache.blocks[attendanceBlockKey(cache.generation, batch.id, next.dayFrom)]?.status === "loaded");
    if (!nextLoaded) return;
    activeBlockIndexRef.current = nextIndex;
    setActiveBlockIndex(nextIndex);
    setRenderedBlockStarts([next.dayFrom, blocks[nextIndex + 1]?.dayFrom].filter(Boolean));
    requestBlockForAllBatches(blocks[nextIndex + 1] ?? next);
  }

  function showPreviousBlock() {
    const currentIndex = activeBlockIndexRef.current;
    if (currentIndex <= 0) return;
    const previous = blocks[currentIndex - 1];
    const current = blocks[currentIndex];
    activeBlockIndexRef.current = currentIndex - 1;
    setActiveBlockIndex(currentIndex - 1);
    setRenderedBlockStarts([previous.dayFrom, current.dayFrom]);
    requestBlockForAllBatches(previous);
  }

  function retryBlock(blockKey) {
    const block = cache.blocks[blockKey];
    const batch = cache.batches.find((item) => item.id === block?.batchId);
    const dayBlock = blocks.find((item) => item.dayFrom === block?.dayFrom);
    if (batch && dayBlock) loadBlock(batch, dayBlock, true);
  }

  function ensureDraft(employee, day) {
    const key = attendanceDayKey(employee.employeeId, day.workDate);
    return drafts[key] ?? { overtimeHours: day.overtimeHours ? String(day.overtimeHours) : "", shifts: Object.fromEntries((day.shifts ?? []).map((shift) => [shift.slotNumber, ""])) };
  }

  function handleCellChange(employee, day, shift, value) {
    if (!shift) return;
    const key = attendanceDayKey(employee.employeeId, day.workDate);
    const current = ensureDraft(employee, day);
    setDrafts((previous) => ({ ...previous, [key]: { ...current, shifts: { ...current.shifts, [shift.slotNumber]: value } } }));
    dayRevisionsRef.current = { ...dayRevisionsRef.current, [key]: (dayRevisionsRef.current[key] ?? 0) + 1 };
    updateDirty(key, (previous) => new Set(previous).add(key));
    setError("");
  }

  function handleOvertimeChange(employee, day, value) {
    const key = attendanceDayKey(employee.employeeId, day.workDate);
    const current = ensureDraft(employee, day);
    setDrafts((previous) => ({ ...previous, [key]: { ...current, overtimeHours: value } }));
    dayRevisionsRef.current = { ...dayRevisionsRef.current, [key]: (dayRevisionsRef.current[key] ?? 0) + 1 };
    updateDirty(key, (previous) => new Set(previous).add(key));
    setError("");
  }

  async function save() {
    const requestedMonthKey = monthKey;
    const requestedGeneration = monthGenerationRef.current;
    const submittedRevisions = Object.fromEntries([...dirtyDayKeys].map((key) => [key, dayRevisionsRef.current[key] ?? 0]));
    setSaving(true);
    setError("");
    try {
      const [year, month] = monthKey.split("-").map(Number);
      const payload = buildAttendanceSavePayload(saveData, drafts, year, month, dirtyDayKeys);
      const result = await api.put("/api/attendance/monthly", payload);
      if (!isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) return;
      setCache((current) => patchAttendanceSave(current, result));
      setDrafts((current) => {
        return mergeAttendanceSaveDrafts(current, result, submittedRevisions, dayRevisionsRef.current).drafts;
      });
      const acknowledgedKeys = new Set((result.employees ?? []).flatMap((employee) => (employee.days ?? [])
        .map((day) => attendanceDayKey(employee.employeeId, day.workDate))
        .filter((key) => submittedRevisions[key] !== undefined && dayRevisionsRef.current[key] === submittedRevisions[key])));
      updateDirty(acknowledgedKeys, (previous) => new Set([...previous].filter((key) => !acknowledgedKeys.has(key))));
    } catch (requestError) {
      if (isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) setError(requestError.message || "Không thể lưu chấm công.");
    } finally {
      if (isCurrentAttendanceRequest(requestedMonthKey, monthKey, requestedGeneration, monthGenerationRef.current)) setSaving(false);
    }
  }

  async function exportExcel() {
    if (dirtyDayKeys.size > 0 || loading || exporting) return;
    const [year, month] = monthKey.split("-");
    setExporting(true);
    setError("");
    try {
      await api.download(
        `/api/attendance/export?year=${year}&month=${month}`,
        `ChamCong_${month}_${year}_tc_t7_cn_ro.xlsx`,
      );
    } catch (requestError) {
      setError(requestError.message || "Không thể xuất file chấm công.");
    } finally {
      setExporting(false);
    }
  }

  const totalEmployees = cache.batches.reduce((total, batch) => total + batch.employeeIds.length, 0);
  const dirty = dirtyDayKeys.size > 0;

  return (
    <div className="erp-feature-page erp-attendance-page">
      <PageHeader title="Chấm công" description="Nhập giờ HC theo ca, nghỉ P/Ô và giờ TC theo ngày." actions={<div className="erp-attendance-actions"><span className="erp-attendance-dirty">{dirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ"}</span><button type="button" className="erp-button erp-button-secondary" onClick={exportExcel} disabled={dirty || loading || exporting}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button><button type="button" className="erp-button erp-button-primary" onClick={save} disabled={saving || !dirty}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button></div>} />
      {error && <Alert variant="error" title="Không thể hoàn tất thao tác.">{error}</Alert>}
      <div className="erp-attendance-toolbar"><div className="erp-attendance-month" aria-label="Chọn tháng"><button type="button" className="erp-button erp-button-secondary" onClick={() => setMonthKey((value) => shiftAttendanceMonth(value, -1))}>←</button><strong>{monthLabel(monthKey)}</strong><button type="button" className="erp-button erp-button-secondary" onClick={() => setMonthKey((value) => shiftAttendanceMonth(value, 1))}>→</button></div><div className="erp-attendance-summary"><span>Đã tải nhân viên: <strong>{totalEmployees}</strong></span><span>Block ngày: <strong>{activeBlock ? `${activeBlock.dayFrom}–${activeBlock.dayTo}` : "—"}</strong></span></div></div>
      <div className="erp-attendance-filters"><label className="erp-field erp-attendance-filter-field"><span className="erp-field-label">Nhân viên</span><select className="erp-control" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Tất cả nhân viên</option>{Object.values(cache.employeesById).map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeCode} — {employee.fullName}</option>)}</select></label><span className="erp-field-hint">Ô trống = chưa nhập · nhập P/Ô cho nghỉ · TC nhập một lần theo ngày</span></div>
      <AttendanceMonthlyMatrix data={visibleData} drafts={drafts} onCellChange={handleCellChange} onOvertimeChange={handleOvertimeChange} loading={loading} scrollLeftRef={scrollLeftRef} onLoadMore={loadMoreEmployees} loadingMore={loadingMore} onHorizontalNearEnd={showNextBlock} onHorizontalNearStart={showPreviousBlock} onRetryBlock={retryBlock} />
    </div>
  );
}
