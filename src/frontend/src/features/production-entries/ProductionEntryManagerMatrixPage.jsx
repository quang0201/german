import React, { useEffect, useMemo, useState } from "react";
import { navigate } from "../../app/navigation.js";
import { DetailPanel } from "../../components/erp/DetailPanel.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FilterBar } from "../../components/erp/FilterBar.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { ProductionEntryDetailPage } from "./ProductionEntryDetailPage.jsx";
import { ProductionExportDialog } from "./ProductionExportDialog.jsx";
import { ProductionMatrixBatchEntryDialog } from "./ProductionMatrixBatchEntryDialog.jsx";
import { ProductionMatrixCellRecordsDialog } from "./ProductionMatrixCellRecordsDialog.jsx";
import { ProductionMatrixQuickEntryDialog } from "./ProductionMatrixQuickEntryDialog.jsx";
import { ProductionMonthNavigator } from "./ProductionMonthNavigator.jsx";
import { ProductionMonthlyMatrix } from "./ProductionMonthlyMatrix.jsx";
import { ProductionSummary } from "./ProductionSummary.jsx";
import { buildProductionExportUrl } from "./productionEntryQuery.js";
import { buildProductionMonthlyMatrixUrl, currentMonthKey, matrixCellAction, monthBounds, shiftMonth } from "./productionMonthlyMatrix.js";
import { localIsoDate } from "./productionPeriod.js";
import "./ProductionMonthlyMatrix.css";

const emptyMatrix = { summary: {}, availableOrders: [], orders: [] };
const emptyFilters = { employeeId: "", operationId: "", search: "" };

export function ProductionEntryManagerMatrixPage({ session, panelEntryId, onPanelClose }) {
  const [monthKey, setMonthKey] = useState(() => currentMonthKey(localIsoDate()));
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [excludeSundays, setExcludeSundays] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [draft, setDraft] = useState(emptyFilters);
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
  const bounds = useMemo(() => monthBounds(monthKey), [monthKey]);

  useEffect(() => {
    api.get("/api/employees").then(setEmployees)
      .catch((requestError) => setError(requestError.message || "Không thể tải nhân viên."));
  }, []);

  useEffect(() => {
    if (!selectedOrderId) { setOperations([]); return; }
    api.get(`/api/production-orders/${selectedOrderId}/operations`).then(setOperations)
      .catch((requestError) => setError(requestError.message || "Không thể tải công đoạn."));
  }, [selectedOrderId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.get(buildProductionMonthlyMatrixUrl({ monthKey, orderId: selectedOrderId, excludeSundays, ...filters }))
      .then((payload) => { if (active) setData(payload); })
      .catch((requestError) => { if (active) setError(requestError.message || "Không thể tải sản lượng tháng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [monthKey, selectedOrderId, excludeSundays, filters, reloadKey]);

  useEffect(() => {
    if (!selectedOrderId) return;
    if (!(data.availableOrders ?? []).some((order) => String(order.id) === String(selectedOrderId))) {
      setSelectedOrderId("");
      setFilters((current) => ({ ...current, operationId: "" }));
      setDraft((current) => ({ ...current, operationId: "" }));
    }
  }, [data.availableOrders, selectedOrderId]);

  function selectOrder(orderId) {
    setSelectedOrderId(String(orderId || ""));
    setFilters((current) => ({ ...current, operationId: "" }));
    setDraft((current) => ({ ...current, operationId: "" }));
  }

  function applyFilters() { setFilters({ ...draft }); }
  function resetFilters() { setDraft(emptyFilters); setFilters(emptyFilters); }
  function reload() { setQuickContext(null); setBatchDay(null); setRecordsContext(null); setReloadKey((value) => value + 1); }

  function handleQuickSaved() {
    toast.success("Đã lưu sản lượng.");
    reload();
  }

  function handleBatchSaved(result) {
    const count = Number(result?.createdCount ?? 0);
    toast.success(count > 0 ? `Đã lưu ${count} công đoạn.` : "Đã lưu nhiều công đoạn.");
    reload();
  }

  function openEntry(id) {
    setRecordsContext(null);
    navigate(`/production/${id}`, { presentation: "panel", backgroundRoute: "/production" });
  }

  function handleCell(context) {
    const action = matrixCellAction(context.cell);
    if (action === "create" || action === "edit-direct") setQuickContext(context);
    else if (action === "open-entry") openEntry(context.cell.records[0].id);
    else setRecordsContext(context);
  }

  async function exportRows(exportRange) {
    try {
      await api.download(buildProductionExportUrl({ ...filters, orderId: selectedOrderId, ...exportRange }), "san-luong.xlsx");
      setExportOpen(false); toast.success("Đã chuẩn bị file Excel.");
    } catch (requestError) { toast.error(requestError.message || "Không thể xuất Excel."); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Sản lượng" description="Theo dõi và nhập sản lượng theo ma trận tháng" actions={<><button type="button" className="erp-button erp-button-secondary" onClick={() => setExportOpen(true)}>Xuất Excel</button><button type="button" className="erp-button erp-button-primary" onClick={() => navigate("/production/new")}>+ Nhập sản lượng</button></>} />
      <div className="erp-production-month-header"><ProductionMonthNavigator monthKey={monthKey} onPrevious={() => setMonthKey((value) => shiftMonth(value, -1))} onNext={() => setMonthKey((value) => shiftMonth(value, 1))} /><span>{bounds.fromDate.split("-").reverse().join("/")} → {bounds.untilDate.split("-").reverse().join("/")}</span></div>
      <ProductionSummary summary={data.summary} operationSelected={Boolean(filters.operationId)} />
      <FilterBar loading={loading} onSubmit={applyFilters} onReset={resetFilters}>
        <Field label="Nhân viên"><select className="erp-control" value={draft.employeeId} onChange={(event) => setDraft((current) => ({ ...current, employeeId: event.target.value }))}><option value="">Tất cả</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></Field>
        <Field label="Công đoạn"><select className="erp-control" value={draft.operationId} disabled={!selectedOrderId} onChange={(event) => setDraft((current) => ({ ...current, operationId: event.target.value }))}><option value="">Tất cả</option>{operations.map((item) => <option key={item.id} value={item.id}>CĐ{item.operationNumber} — {item.name}</option>)}</select></Field>
        <Field label="Tìm kiếm"><input className="erp-control" value={draft.search} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} placeholder="Mã NV, họ tên, Mã SX..." /></Field>
      </FilterBar>
      <ProductionMonthlyMatrix data={data} monthKey={monthKey} selectedOrderId={selectedOrderId} excludeSundays={excludeSundays} loading={loading} error={error} onSelectOrder={selectOrder} onToggleSundays={setExcludeSundays} onCellClick={handleCell} onDayHeaderClick={setBatchDay} />
      <ProductionMatrixQuickEntryDialog context={quickContext} onClose={() => setQuickContext(null)} onSaved={handleQuickSaved} />
      <ProductionMatrixBatchEntryDialog day={batchDay} employees={employees} onClose={() => setBatchDay(null)} onSaved={handleBatchSaved} />
      <ProductionMatrixCellRecordsDialog context={recordsContext} onClose={() => setRecordsContext(null)} onOpenEntry={openEntry} />
      <ProductionExportDialog open={exportOpen} initialMode="month" initialAnchorDate={`${monthKey}-01`} initialFromDate={bounds.fromDate} initialUntilDate={bounds.untilDate} onClose={() => setExportOpen(false)} onExport={exportRows} />
      <DetailPanel open={Boolean(panelEntryId)} title="Chi tiết sản lượng" onClose={onPanelClose}>
        {panelEntryId && <ProductionEntryDetailPage session={session} entryId={panelEntryId} inPanel onClose={onPanelClose} onChanged={reload} />}
      </DetailPanel>
    </div>
  );
}
