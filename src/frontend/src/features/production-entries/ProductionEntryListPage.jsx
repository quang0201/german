import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { navigate } from "../../app/navigation.js";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { DataTable } from "../../components/erp/DataTable.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { FilterBar } from "../../components/erp/FilterBar.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { DetailPanel } from "../../components/erp/DetailPanel.jsx";
import { Pagination } from "../../components/erp/Pagination.jsx";
import { buildProductionEntryListQuery, normalizeProductionEntryListResponse } from "./productionEntryQuery.js";
import { ProductionEntryDetailPage } from "./ProductionEntryDetailPage.jsx";

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function defaultFilters() {
  const today = localToday();
  return { fromDate: today, untilDate: today, employeeId: "", orderId: "", operationId: "", search: "", page: 1, pageSize: 50 };
}

export function ProductionEntryListPage({ session, panelEntryId, onPanelClose }) {
  const isWorker = session?.role === "Worker";
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [data, setData] = useState({ items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const toast = useToast();

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
    { key: "workDate", label: "Ngày", className: "erp-column-sticky-mobile", render: (row) => row.workDate },
    { key: "employeeCode", label: "Mã NV", className: isWorker ? "erp-column-mobile-hidden" : "", render: (row) => <strong>{row.employeeCode}</strong> },
    { key: "employeeName", label: "Họ tên", className: "erp-column-mobile-hidden", render: (row) => row.employeeName },
    { key: "productionOrderCode", label: "Mã SX", render: (row) => row.productionOrderCode },
    { key: "operationNumber", label: "CĐ", render: (row) => `CĐ${row.operationNumber}` },
    { key: "hcQuantity", label: "HC", className: "text-right erp-column-mobile-hidden", render: (row) => row.hcQuantity },
    { key: "tcQuantity", label: "TC", className: "text-right erp-column-mobile-hidden", render: (row) => row.tcQuantity },
    { key: "totalQuantity", label: "Tổng", className: "text-right font-bold", render: (row) => row.totalQuantity },
    { key: "entryMode", label: "Kiểu nhập", className: "erp-column-mobile-hidden", render: (row) => row.entryMode },
    { key: "actions", label: "Thao tác", className: "text-right", render: () => <span className="text-blue-700">Xem →</span> },
  ], [isWorker]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value, ...(key === "orderId" ? { operationId: "" } : {}) }));
  }

  function submitFilters() {
    setFilters({ ...draft, page: 1 });
  }

  function resetFilters() {
    const value = defaultFilters();
    setDraft(value);
    setFilters(value);
  }

  function changePage(page) {
    setFilters((current) => ({ ...current, page }));
    setDraft((current) => ({ ...current, page }));
  }

  async function exportRows() {
    try {
      await api.download(`/api/reports/production/export.xlsx?fromDate=${encodeURIComponent(filters.fromDate)}&untilDate=${encodeURIComponent(filters.untilDate)}`, "san-luong.xlsx");
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
        actions={!isWorker && <><button type="button" className="erp-button erp-button-secondary" onClick={exportRows}>Xuất Excel</button><button type="button" className="erp-button erp-button-primary" onClick={() => navigate("/production/new")}>+ Nhập sản lượng</button></>}
      />
      {!isWorker && <FilterBar loading={loading} onSubmit={submitFilters} onReset={resetFilters}>
        <Field label="Từ ngày"><input className="erp-control" type="date" value={draft.fromDate} onChange={(event) => updateDraft("fromDate", event.target.value)} /></Field>
        <Field label="Đến ngày"><input className="erp-control" type="date" value={draft.untilDate} onChange={(event) => updateDraft("untilDate", event.target.value)} /></Field>
        <Field label="Nhân viên"><select className="erp-control" value={draft.employeeId} onChange={(event) => updateDraft("employeeId", event.target.value)}><option value="">Tất cả</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.employeeCode} — {item.fullName}</option>)}</select></Field>
        <Field label="Mã sản xuất"><select className="erp-control" value={draft.orderId} onChange={(event) => updateDraft("orderId", event.target.value)}><option value="">Tất cả</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.productName}</option>)}</select></Field>
        <Field label="Công đoạn"><select className="erp-control" value={draft.operationId} onChange={(event) => updateDraft("operationId", event.target.value)}><option value="">Tất cả</option>{operations.map((item) => <option key={item.id} value={item.id}>CĐ{item.operationNumber} — {item.name}</option>)}</select></Field>
        <Field label="Tìm kiếm"><input className="erp-control" value={draft.search} onChange={(event) => updateDraft("search", event.target.value)} placeholder="Mã NV, họ tên, mã SX..." /></Field>
      </FilterBar>}
      <DataTable columns={columns} rows={data.items} loading={loading} error={error} density="compact" className={`erp-production-table ${isWorker ? "erp-production-table-worker" : "erp-production-table-manager"}`} emptyMessage="Không có sản lượng phù hợp bộ lọc." rowKey="id" onRowClick={(row) => { const mobile = window.matchMedia?.("(max-width: 767px)").matches; navigate(`/production/${row.id}`, mobile ? {} : { presentation: "panel", backgroundRoute: "/production" }); }} />
      <Pagination page={data.page} pageSize={filters.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} loading={loading} onPageChange={changePage} onPageSizeChange={(pageSize) => { setFilters((current) => ({ ...current, page: 1, pageSize })); setDraft((current) => ({ ...current, page: 1, pageSize })); }} />
      <DetailPanel open={Boolean(panelEntryId)} title="Chi tiết sản lượng" onClose={onPanelClose}>
        {panelEntryId && <ProductionEntryDetailPage session={session} entryId={panelEntryId} inPanel onClose={onPanelClose} onChanged={() => setReloadKey((value) => value + 1)} />}
      </DetailPanel>
    </div>
  );
}
