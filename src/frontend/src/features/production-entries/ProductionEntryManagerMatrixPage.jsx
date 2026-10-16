import React, { useEffect, useMemo, useReducer, useState } from "react";
import { navigate } from "../../app/navigation.js";
import { DetailPanel } from "../../components/erp/DetailPanel.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { Icon } from "../../components/erp/Icon.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { queryDate, readQuery, useQuerySync } from "../../lib/queryState.js";
import { employeeVisibleForMonth } from "../employees/employeeVisibility.js";
import { ProductionEntryDetailPage } from "./ProductionEntryDetailPage.jsx";
import { ProductionExportDialog } from "./ProductionExportDialog.jsx";
import { ProductionMatrixBatchEntryDialog } from "./ProductionMatrixBatchEntryDialog.jsx";
import { ProductionMatrixCellRecordsDialog } from "./ProductionMatrixCellRecordsDialog.jsx";
import { ProductionMatrixQuickEntryDialog } from "./ProductionMatrixQuickEntryDialog.jsx";
import { ProductionWeekGrid } from "./ProductionWeekGrid.jsx";
import "./ProductionMonthlyMatrix.css";
import { buildProductionExportUrl } from "./productionEntryQuery.js";
import { productionExportFileName } from "./productionExport.js";
import { buildProductionWeeklyMatrixUrl, currentMonthKey, isEmployeeReadOnlyOnDate, matrixCellAction } from "./productionMonthlyMatrix.js";
import { localIsoDate } from "./productionPeriod.js";
import { derivePeriodRange, shiftPeriod } from "./productionPeriod.js";
import { ProductionWeekNavigator } from "./ProductionWeekNavigator.jsx";
import { mobileFilterPanelReducer } from "./productionFilterPanel.js";

const emptyMatrix = { summary: {}, availableOrders: [], orders: [] };
const emptyFilters = { employeeId: "", operationId: "", search: "" };
const COMPACT_KEY = "german.production.compactGrid";

function readCompact() {
  try { return window.localStorage.getItem(COMPACT_KEY) === "1"; } catch { return false; }
}

function saveCompact(value) {
  try { window.localStorage.setItem(COMPACT_KEY, value ? "1" : "0"); } catch { /* per-viewer convenience only */ }
}

export function ProductionEntryManagerMatrixPage({ session, panelEntryId, onPanelClose }) {
  const [initialQuery] = useState(() => readQuery(["date", "order", "employee", "operation", "q"]));
  const initialFilters = { employeeId: initialQuery.employee, operationId: initialQuery.operation, search: initialQuery.q };
  const [weekAnchorDate, setWeekAnchorDate] = useState(() => queryDate(initialQuery.date, localIsoDate()));
  const [selectedOrderId, setSelectedOrderId] = useState(initialQuery.order);
  const [filters, setFilters] = useState(initialFilters);
  const [searchText, setSearchText] = useState(initialFilters.search ?? "");
  const [compact, setCompact] = useState(() => typeof window === "undefined" ? false : readCompact());
  const [mobileFiltersOpen, dispatchMobileFilterPanel] = useReducer(mobileFilterPanelReducer, false);
  const [employees, setEmployees] = useState([]);
  const [operations, setOperations] = useState([]);
  const [data, setData] = useState(emptyMatrix);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [quickContext, setQuickContext] = useState(null);
  const [batchDay, setBatchDay] = useState(null);
  const [recordsContext, setRecordsContext] = useState(null);
  const toast = useToast();
  const weekRange = useMemo(() => derivePeriodRange({ periodMode: "week", anchorDate: weekAnchorDate }), [weekAnchorDate]);
  const monthKey = currentMonthKey(weekAnchorDate);
  useQuerySync(
    { date: weekAnchorDate, order: selectedOrderId, employee: filters.employeeId, operation: filters.operationId, q: filters.search },
    { date: localIsoDate() },
  );

  useEffect(() => {
    api.get("/api/employees").then(setEmployees)
      .catch((requestError) => setError(requestError.message || "Không thể tải nhân viên."));
  }, []);

  useEffect(() => {
    const visibleIds = new Set(
      employees.filter((employee) => employeeVisibleForMonth(employee, monthKey)).map((employee) => String(employee.id)),
    );
    setFilters((current) => current.employeeId && !visibleIds.has(String(current.employeeId))
      ? { ...current, employeeId: "" }
      : current);
  }, [employees, monthKey]);

  useEffect(() => {
    if (!selectedOrderId) { setOperations([]); return; }
    api.get(`/api/production-orders/${selectedOrderId}/operations`).then(setOperations)
      .catch((requestError) => setError(requestError.message || "Không thể tải công đoạn."));
  }, [selectedOrderId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.get(buildProductionWeeklyMatrixUrl({ ...weekRange, orderId: selectedOrderId, excludeSundays: false, ...filters }))
      .then((payload) => { if (active) setData(payload); })
      .catch((requestError) => { if (active) setError(requestError.message || "Không thể tải sản lượng tháng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [weekRange, selectedOrderId, filters, reloadKey]);

  // An empty selection means "all production codes"; only a code that disappeared from the week is cleared.
  useEffect(() => {
    if (loading || !selectedOrderId) return;
    const availableOrders = data.availableOrders ?? [];
    if (!availableOrders.some((order) => String(order.id) === String(selectedOrderId))) {
      setSelectedOrderId("");
      setFilters((current) => ({ ...current, operationId: "" }));
    }
  }, [data.availableOrders, selectedOrderId, loading]);

  // Filters apply as soon as they change; typing in the search box waits for a short pause.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => current.search === searchText ? current : { ...current, search: searchText }), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  function selectOrder(orderId) {
    setSelectedOrderId(String(orderId || ""));
    setFilters((current) => ({ ...current, operationId: "" }));
  }

  function setFilter(key, value) { setFilters((current) => ({ ...current, [key]: value })); }
  function resetFilters() { setSelectedOrderId(""); setSearchText(""); setFilters(emptyFilters); dispatchMobileFilterPanel("reset"); }
  function toggleCompact(value) { setCompact(value); saveCompact(value); }
  function reload() { setQuickContext(null); setBatchDay(null); setRecordsContext(null); setReloadKey((value) => value + 1); }

  function handleQuickSaved() {
    toast.success("Đã lưu sản lượng.");
    reload();
  }

  function handleBatchSaved(result) {
    if (result?.attendanceOnly) {
      toast.success("Đã lưu chấm công.");
      reload();
      return;
    }
    const count = Number(result?.createdCount ?? 0);
    toast.success(count > 0 ? `Đã lưu ${count} công đoạn.` : "Đã lưu nhiều công đoạn.");
    reload();
  }

  function openEntry(id) {
    setRecordsContext(null);
    navigate(`/production/${id}`, { presentation: "panel", backgroundRoute: "/production" });
  }

  function handleDayHeaderClick(day) {
    setBatchDay({ ...day, preferredOrderId: selectedOrderId, preferredEmployeeId: filters.employeeId });
  }

  function handlePendingDay(employee, day) {
    setBatchDay({ ...day, preferredOrderId: selectedOrderId, preferredEmployeeId: String(employee.employeeId) });
  }

  function handleCell(context) {
    if (isEmployeeReadOnlyOnDate(context.employee, context.workDate)) return;
    const action = matrixCellAction(context.cell);
    if (action === "create" || action === "edit-direct") setQuickContext(context);
    else if (action === "open-entry") openEntry(context.cell.records[0].id);
    else setRecordsContext(context);
  }

  async function exportRows(exportRange) {
    try {
      await api.download(buildProductionExportUrl({ ...filters, orderId: selectedOrderId, ...exportRange }), productionExportFileName(exportRange.fromDate, exportRange.untilDate));
      setExportOpen(false); toast.success("Đã chuẩn bị file Excel.");
    } catch (requestError) { toast.error(requestError.message || "Không thể xuất Excel."); }
  }

  const availableOrders = data.availableOrders ?? [];
  const filtering = Boolean(selectedOrderId || filters.employeeId || filters.operationId || filters.search);

  return (
    <div className="erp-feature-page erp-production-manager-page">
      <div className="erp-production-controls">
        <div className="erp-production-controls-header">
          <h1 className="erp-production-title">Sản lượng</h1>
          <ProductionWeekNavigator fromDate={weekRange.fromDate} untilDate={weekRange.untilDate} onPrevious={() => setWeekAnchorDate((value) => shiftPeriod("week", value, -1))} onNext={() => setWeekAnchorDate((value) => shiftPeriod("week", value, 1))} />
          <button type="button" className="erp-button erp-button-secondary erp-button-small" onClick={() => setWeekAnchorDate(localIsoDate())}>Tuần này</button>
          <div className="erp-page-actions"><button type="button" className="erp-button erp-button-secondary" onClick={() => setExportOpen(true)}><Icon name="download" size={17} />Xuất Excel</button><button type="button" className="erp-button erp-button-primary" onClick={() => navigate("/production/new")}><Icon name="plus" size={17} />Nhập sản lượng</button></div>
        </div>
        <button type="button" className="erp-production-mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="erp-production-filter-panel" onClick={() => dispatchMobileFilterPanel("toggle")}>
          <span>Bộ lọc</span>
          <strong>{availableOrders.find((order) => String(order.id) === String(selectedOrderId))?.code ?? "Tất cả mã SX"}</strong>
          {filtering && <span className="erp-production-filter-active">Đang lọc</span>}
          <span className="erp-production-filter-open-label">{mobileFiltersOpen ? "Đóng" : "Mở lọc"}<span aria-hidden="true">{mobileFiltersOpen ? "⌃" : "⌄"}</span></span>
        </button>
        <div id="erp-production-filter-panel" className={`erp-production-filter-panel${mobileFiltersOpen ? " is-open" : ""}`}>
          <div className="erp-production-filter-panel-header">
            <strong>Bộ lọc</strong>
            <button type="button" className="erp-button erp-button-secondary erp-production-filter-close" aria-label="Đóng bộ lọc" onClick={() => dispatchMobileFilterPanel("close")}>Đóng</button>
          </div>
          <div className="erp-production-filter-row">
            <Field label="Mã sản xuất"><select className="erp-control" value={selectedOrderId} onChange={(event) => selectOrder(event.target.value)}><option value="">Tất cả mã SX ({availableOrders.length})</option>{availableOrders.map((order) => <option key={order.id} value={order.id}>{order.code} — {order.productName}</option>)}</select></Field>
            <Field label="Nhân viên"><select className="erp-control" value={filters.employeeId} onChange={(event) => setFilter("employeeId", event.target.value)}><option value="">Tất cả</option>{employees.filter((item) => employeeVisibleForMonth(item, monthKey)).map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></Field>
            <Field label="Công đoạn"><select className="erp-control" value={filters.operationId} disabled={!selectedOrderId} title={selectedOrderId ? undefined : "Chọn một mã SX để lọc theo công đoạn"} onChange={(event) => setFilter("operationId", event.target.value)}><option value="">Tất cả</option>{operations.map((item) => <option key={item.id} value={item.id}>CĐ{item.operationNumber} — {item.name}</option>)}</select></Field>
            <Field label="Tìm kiếm"><input className="erp-control" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Mã NV, họ tên, Mã SX..." /></Field>
            {filtering && <button type="button" className="erp-button erp-button-secondary erp-production-filter-reset" onClick={resetFilters}>Xóa lọc</button>}
            <div className="erp-production-view-switch" role="group" aria-label="Cách hiện mỗi ngày">
              <button type="button" className={compact ? "" : "is-on"} aria-pressed={!compact} onClick={() => toggleCompact(false)}>HC · TC · Tổng</button>
              <button type="button" className={compact ? "is-on" : ""} aria-pressed={compact} onClick={() => toggleCompact(true)}>Chỉ Tổng</button>
            </div>
          </div>
        </div>
      </div>
      <div className="erp-week-legend" role="list" aria-label="Chú giải">
        <span role="listitem"><i className="is-missing" aria-hidden="true">!</i>Đã đi làm, chưa nhập công đoạn</span>
        <span role="listitem"><i className="is-leave" aria-hidden="true">P</i>Nghỉ phép</span>
        <span role="listitem"><i className="is-future" aria-hidden="true" />Chưa tới ngày</span>
        <span className="erp-week-legend-help">Bấm vào ô để nhập hoặc sửa · Bấm tiêu đề ngày để nhập nhiều người</span>
      </div>
      <ProductionWeekGrid data={data} fromDate={weekRange.fromDate} untilDate={weekRange.untilDate} compact={compact} loading={loading} error={error} onCellClick={handleCell} onDayHeaderClick={handleDayHeaderClick} onPendingDayClick={handlePendingDay} />
      <ProductionMatrixQuickEntryDialog context={quickContext} onClose={() => setQuickContext(null)} onSaved={handleQuickSaved} onReload={reload} />
      <ProductionMatrixBatchEntryDialog day={batchDay} employees={employees} onClose={() => setBatchDay(null)} onSaved={handleBatchSaved} />
      <ProductionMatrixCellRecordsDialog context={recordsContext} onClose={() => setRecordsContext(null)} onOpenEntry={openEntry} />
      <ProductionExportDialog open={exportOpen} initialMode="week" initialAnchorDate={weekAnchorDate} initialFromDate={weekRange.fromDate} initialUntilDate={weekRange.untilDate} onClose={() => setExportOpen(false)} onExport={exportRows} />
      <DetailPanel open={Boolean(panelEntryId)} title="Chi tiết sản lượng" onClose={onPanelClose}>
        {panelEntryId && <ProductionEntryDetailPage session={session} entryId={panelEntryId} inPanel onClose={onPanelClose} onChanged={reload} />}
      </DetailPanel>
    </div>
  );
}
