import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { navigate } from "../../app/navigation.js";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FilterBar } from "../../components/erp/FilterBar.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { DetailPanel } from "../../components/erp/DetailPanel.jsx";
import { Pagination } from "../../components/erp/Pagination.jsx";
import { buildProductionEntryListQuery, buildProductionExportUrl, normalizeProductionEntryListResponse } from "./productionEntryQuery.js";
import { ProductionEntryDetailPage } from "./ProductionEntryDetailPage.jsx";
import { ProductionEntryGroupedTable } from "./ProductionEntryGroupedTable.jsx";
import { PeriodSelector } from "./PeriodSelector.jsx";
import { ProductionSummary } from "./ProductionSummary.jsx";
import { ProductionExportDialog } from "./ProductionExportDialog.jsx";
import { listRangeError, productionExportFileName } from "./productionExport.js";
import { derivePeriodRange, formatDisplayDate, localIsoDate, shiftPeriod } from "./productionPeriod.js";
import { entryModeLabel } from "../../lib/i18n.js";

function emptyBusinessFilters() {
  return { employeeId: "", orderId: "", operationId: "", search: "" };
}

function initialFilters(today) {
  return { fromDate: today, untilDate: today, ...emptyBusinessFilters(), page: 1, pageSize: 50 };
}

function customRangeError(fromDate, untilDate) {
  return listRangeError(fromDate, untilDate);
}

function exportLabel() {
  return "Xuất Excel";
}

export function ProductionEntryListPage({ session, panelEntryId, onPanelClose }) {
  const isWorker = session?.role === "Worker";
  const [today] = useState(() => localIsoDate());
  const [appliedPeriod, setAppliedPeriod] = useState(() => ({ periodMode: "day", anchorDate: today, customFromDate: today, customUntilDate: today }));
  const [customDraft, setCustomDraft] = useState(() => ({ fromDate: today, untilDate: today }));
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [filters, setFilters] = useState(() => initialFilters(today));
  const [draft, setDraft] = useState(emptyBusinessFilters);
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [data, setData] = useState({ items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0, summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const toast = useToast();
  const customEditorVisible = isCustomEditing || appliedPeriod.periodMode === "custom";
  const rangeError = customEditorVisible ? customRangeError(customDraft.fromDate, customDraft.untilDate) : "";

  useEffect(() => {
    if (isWorker) return undefined;
    Promise.all([api.get("/api/employees"), api.get("/api/production-orders")])
      .then(([employeeRows, orderRows]) => { setEmployees(employeeRows); setOrders(orderRows); })
      .catch((requestError) => setError(requestError.message || "Không thể tải bộ lọc."));
  }, [isWorker]);

  useEffect(() => {
    if (isWorker || !draft.orderId) { setOperations([]); return; }
    api.get(`/api/production-orders/${draft.orderId}/operations`)
      .then(setOperations)
      .catch((requestError) => setError(requestError.message || "Không thể tải công đoạn."));
  }, [draft.orderId, isWorker]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get(buildProductionEntryListQuery({ ...filters, basePath: isWorker ? "/api/production-entries/mine" : "/api/production-entries" }))
      .then((payload) => active && setData(normalizeProductionEntryListResponse(payload)))
      .catch((requestError) => active && setError(requestError.message || "Không thể tải sản lượng."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters, isWorker, reloadKey]);

  const columns = useMemo(() => [
    { key: "workDate", label: "Ngày", className: "erp-column-sticky-mobile", render: (row) => formatDisplayDate(row.workDate) },
    { key: "employeeCode", label: "Mã NV", className: isWorker ? "erp-column-mobile-hidden" : "", render: (row) => <strong>{row.employeeCode}</strong> },
    { key: "employeeName", label: "Họ tên", className: "erp-column-mobile-hidden", render: (row) => row.employeeName },
    { key: "productionOrderCode", label: "Mã SX", render: (row) => row.productionOrderCode },
    { key: "operationNumber", label: "CĐ", render: (row) => `CĐ${row.operationNumber}` },
    { key: "hcQuantity", label: "HC", className: "text-right erp-column-mobile-hidden", render: (row) => row.hcQuantity },
    { key: "tcQuantity", label: "TC", className: "text-right erp-column-mobile-hidden", render: (row) => row.tcQuantity },
    { key: "totalQuantity", label: "Tổng", className: "text-right font-bold", render: (row) => row.totalQuantity },
    { key: "entryMode", label: "Kiểu nhập", className: "erp-column-mobile-hidden", render: (row) => entryModeLabel(row.entryMode) },
    { key: "actions", label: "Thao tác", className: "text-right", render: () => <span className="text-blue-700">Xem →</span> },
  ], [isWorker]);

  function applyPeriod(nextPeriod) {
    const range = derivePeriodRange(nextPeriod);
    setAppliedPeriod(nextPeriod);
    setIsCustomEditing(false);
    setFilters((current) => ({ ...current, ...range, page: 1 }));
  }

  function selectPreset(preset) {
    const currentDay = localIsoDate();
    if (preset === "custom") {
      setCustomDraft({ fromDate: filters.fromDate, untilDate: filters.untilDate });
      setIsCustomEditing(true);
      return;
    }

    const anchorDate = preset === "yesterday" ? shiftPeriod("day", currentDay, -1) : currentDay;
    applyPeriod({ ...appliedPeriod, periodMode: preset === "today" || preset === "yesterday" ? "day" : preset, anchorDate });
  }

  function shiftCurrentPeriod(direction) {
    const anchorDate = shiftPeriod(appliedPeriod.periodMode, appliedPeriod.anchorDate, direction);
    applyPeriod({ ...appliedPeriod, anchorDate });
  }

  function updateCustomDate(key, value) {
    setCustomDraft((current) => ({ ...current, [key]: value }));
  }

  function submitCustomPeriod() {
    if (rangeError) return;
    setAppliedPeriod((current) => ({
      ...current,
      periodMode: "custom",
      customFromDate: customDraft.fromDate,
      customUntilDate: customDraft.untilDate,
    }));
    setIsCustomEditing(false);
    setFilters((current) => ({ ...current, fromDate: customDraft.fromDate, untilDate: customDraft.untilDate, page: 1 }));
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value, ...(key === "orderId" ? { operationId: "" } : {}) }));
  }

  function submitFilters() {
    setFilters((current) => ({ ...current, ...draft, page: 1 }));
  }

  function resetFilters() {
    const value = emptyBusinessFilters();
    setDraft(value);
    setFilters((current) => ({ ...current, ...value, page: 1 }));
  }

  function changePage(page) {
    setFilters((current) => ({ ...current, page }));
  }

  function openExportDialog() {
    setExportDialogOpen(true);
  }

  async function exportRows(exportRange) {
    try {
      await api.download(buildProductionExportUrl({ ...filters, ...exportRange }), productionExportFileName(exportRange.fromDate, exportRange.untilDate));
      setExportDialogOpen(false);
      toast.success("Đã chuẩn bị file Excel.");
    } catch (requestError) {
      toast.error(requestError.message || "Không thể xuất Excel.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sản lượng"
        description="Theo dõi và quản lý sản lượng sản xuất"
        actions={!isWorker && <><button type="button" className="erp-button erp-button-secondary" onClick={openExportDialog}>{exportLabel(appliedPeriod.periodMode)}</button><button type="button" className="erp-button erp-button-primary" onClick={() => navigate("/production/new")}>+ Nhập sản lượng</button></>}
      />
      <PeriodSelector
        periodMode={appliedPeriod.periodMode}
        anchorDate={appliedPeriod.anchorDate}
        customFromDate={customDraft.fromDate}
        customUntilDate={customDraft.untilDate}
        appliedCustomFromDate={appliedPeriod.customFromDate}
        appliedCustomUntilDate={appliedPeriod.customUntilDate}
        isCustomEditing={isCustomEditing}
        onPreset={selectPreset}
        onShift={shiftCurrentPeriod}
        onCustomChange={updateCustomDate}
      />
      {customEditorVisible && <div className="erp-period-custom-actions">
        {rangeError && <p className="erp-inline-message erp-inline-error" role="alert">{rangeError}</p>}
        <button type="button" className="erp-button erp-button-primary" onClick={submitCustomPeriod} disabled={Boolean(rangeError)}>Áp dụng khoảng ngày</button>
      </div>}
      <ProductionSummary summary={data.summary} operationSelected={Boolean(filters.operationId)} />
      {!isWorker && <FilterBar loading={loading} onSubmit={submitFilters} onReset={resetFilters}>
        <Field label="Nhân viên"><select className="erp-control" value={draft.employeeId} onChange={(event) => updateDraft("employeeId", event.target.value)}><option value="">Tất cả</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></Field>
        <Field label="Mã sản xuất"><select className="erp-control" value={draft.orderId} onChange={(event) => updateDraft("orderId", event.target.value)}><option value="">Tất cả</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}</select></Field>
        <Field label="Công đoạn"><select className="erp-control" value={draft.operationId} onChange={(event) => updateDraft("operationId", event.target.value)}><option value="">Tất cả</option>{operations.map((item) => <option key={item.id} value={item.id}>CĐ{item.operationNumber} — {item.name}</option>)}</select></Field>
        <Field label="Tìm kiếm"><input className="erp-control" value={draft.search} onChange={(event) => updateDraft("search", event.target.value)} placeholder="Mã NV, họ tên, mã SX..." /></Field>
      </FilterBar>}
      <ProductionEntryGroupedTable columns={columns} rows={data.items} loading={loading} error={error} density="normal" className={`erp-production-table ${isWorker ? "erp-production-table-worker" : "erp-production-table-manager"}`} emptyMessage="Không có sản lượng phù hợp bộ lọc." rowKey="id" multiDay={filters.fromDate !== filters.untilDate} onRowClick={(row) => { const mobile = window.matchMedia?.("(max-width: 767px)").matches; navigate(`/production/${row.id}`, mobile ? {} : { presentation: "panel", backgroundRoute: "/production" }); }} />
      <Pagination page={data.page} pageSize={filters.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} loading={loading} onPageChange={changePage} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} />
      <ProductionExportDialog
        open={exportDialogOpen}
        initialMode={appliedPeriod.periodMode}
        initialAnchorDate={appliedPeriod.anchorDate}
        initialFromDate={filters.fromDate}
        initialUntilDate={filters.untilDate}
        onClose={() => setExportDialogOpen(false)}
        onExport={exportRows}
      />
      <DetailPanel open={Boolean(panelEntryId)} title="Chi tiết sản lượng" onClose={onPanelClose}>
        {panelEntryId && <ProductionEntryDetailPage session={session} entryId={panelEntryId} inPanel onClose={onPanelClose} onChanged={() => setReloadKey((value) => value + 1)} />}
      </DetailPanel>
    </div>
  );
}
