import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { Icon } from "../../components/erp/Icon.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { queryChoice, queryDate, readQuery, useQuerySync } from "../../lib/queryState.js";
import { PeriodSelector } from "../production-entries/PeriodSelector.jsx";
import { productionExportFileName } from "../production-entries/productionExport.js";
import { derivePeriodRange, localIsoDate, shiftPeriod } from "../production-entries/productionPeriod.js";
import { OrderMultiSelect } from "./OrderMultiSelect.jsx";
import { ProductionOperationSummaryChart } from "./ProductionOperationSummaryChart.jsx";
import { buildOrderParam, mergeOperationSummaries, parseOrderParam } from "./productionOperationMerge.js";

export function currentReportMonthRange(today = new Date()) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  return { fromDate: localIsoDate(first), untilDate: localIsoDate(last) };
}

export function buildProductionReportExportUrl(fromDate, untilDate, orders = []) {
  const params = new URLSearchParams({ fromDate, untilDate });
  const ids = Array.isArray(orders) ? orders : orders ? [orders] : [];
  if (ids.length === 1) params.set("orderId", ids[0]);
  else if (ids.length > 1) params.set("orderIds", ids.join(","));
  return `/api/reports/production/export.xlsx?${params.toString()}`;
}

export function buildProductionReportSummaryUrl(orderId, fromDate, untilDate, refresh = "") {
  const params = new URLSearchParams({ orderId, fromDate, untilDate });
  if (refresh) params.set("refresh", refresh);
  return `/api/reports/production/summary?${params.toString()}`;
}

function reportRangeError(fromDate, untilDate) {
  if (!fromDate || !untilDate) return "Chọn đầy đủ từ ngày và đến ngày.";
  if (fromDate > untilDate) return "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.";
  return "";
}

export function ReportPage() {
  const initialRange = currentReportMonthRange();
  const [today] = useState(() => localIsoDate());
  const [initialQuery] = useState(() => readQuery(["mode", "date", "from", "until", "order"]));
  const [initialPeriod] = useState(() => ({
    periodMode: queryChoice(initialQuery.mode, ["day", "week", "month", "custom"], "month"),
    anchorDate: queryDate(initialQuery.date, today),
    customFromDate: queryDate(initialQuery.from, initialRange.fromDate),
    customUntilDate: queryDate(initialQuery.until, initialRange.untilDate),
  }));
  const [initialDates] = useState(() => derivePeriodRange(initialPeriod));
  const [fromDate, setFromDate] = useState(initialDates.fromDate);
  const [untilDate, setUntilDate] = useState(initialDates.untilDate);
  const [appliedPeriod, setAppliedPeriod] = useState(initialPeriod);
  const [customDraft, setCustomDraft] = useState(() => ({ fromDate: initialDates.fromDate, untilDate: initialDates.untilDate }));
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderIds, setOrderIds] = useState(() => parseOrderParam(initialQuery.order));
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderError, setOrderError] = useState("");
  const [summaryResults, setSummaryResults] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const toast = useToast();
  useQuerySync(
    {
      mode: appliedPeriod.periodMode,
      date: appliedPeriod.anchorDate,
      from: appliedPeriod.periodMode === "custom" ? appliedPeriod.customFromDate : "",
      until: appliedPeriod.periodMode === "custom" ? appliedPeriod.customUntilDate : "",
      order: buildOrderParam(orderIds),
    },
    { mode: "month", date: today },
  );
  const productNames = useMemo(() => Object.fromEntries(products.map((product) => [product.code, product.name])), [products]);
  const summary = useMemo(() => {
    if (!summaryResults) return null;
    const codes = new Set(orderIds.map((id) => orders.find((order) => order.id === id)?.productCode ?? ""));
    const sharedCode = codes.size === 1 ? [...codes][0] : "";
    return mergeOperationSummaries(summaryResults, orders, sharedCode ? products.find((product) => product.code === sharedCode) : null);
  }, [summaryResults, orders, orderIds, products]);
  const customEditorVisible = isCustomEditing || appliedPeriod.periodMode === "custom";
  const customError = customEditorVisible ? reportRangeError(customDraft.fromDate, customDraft.untilDate) : "";

  const refreshing = refreshToken > 0 && (ordersLoading || summaryLoading);

  function applyPeriod(nextPeriod) {
    const range = derivePeriodRange(nextPeriod);
    setAppliedPeriod(nextPeriod);
    setIsCustomEditing(false);
    setFromDate(range.fromDate);
    setUntilDate(range.untilDate);
  }

  function selectPreset(preset) {
    if (preset === "custom") {
      setCustomDraft({ fromDate, untilDate });
      setIsCustomEditing(true);
      return;
    }

    const currentDay = localIsoDate();
    const anchorDate = preset === "yesterday" ? shiftPeriod("day", currentDay, -1) : currentDay;
    applyPeriod({ ...appliedPeriod, periodMode: preset === "today" || preset === "yesterday" ? "day" : preset, anchorDate });
  }

  function shiftCurrentPeriod(direction) {
    applyPeriod({ ...appliedPeriod, anchorDate: shiftPeriod(appliedPeriod.periodMode, appliedPeriod.anchorDate, direction) });
  }

  function updateCustomDate(key, value) {
    setCustomDraft((current) => ({ ...current, [key]: value }));
  }

  function submitCustomPeriod() {
    if (customError) return;
    setAppliedPeriod((current) => ({ ...current, periodMode: "custom", customFromDate: customDraft.fromDate, customUntilDate: customDraft.untilDate }));
    setIsCustomEditing(false);
    setFromDate(customDraft.fromDate);
    setUntilDate(customDraft.untilDate);
  }

  useEffect(() => {
    api.get("/api/products").then(setProducts).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    setOrderError("");
    api.get("/api/production-orders")
      .then((items) => {
        if (!active) return;
        setOrders(items);
        setOrderIds((current) => {
          const known = current.filter((id) => items.some((order) => order.id === id));
          if (known.length > 0) return known;
          const fallback = (items.find((order) => order.status === "InProduction") ?? items[0])?.id;
          return fallback ? [fallback] : [];
        });
      })
      .catch((requestError) => {
        if (active) setOrderError(requestError.message || "Không thể tải danh sách Mã SX.");
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => { active = false; };
  }, [refreshToken]);

  useEffect(() => {
    if (orderIds.length === 0 || !fromDate || !untilDate) {
      setSummaryResults(null);
      setSummaryError("");
      setSummaryLoading(false);
      return undefined;
    }
    if (fromDate > untilDate) {
      setSummaryResults(null);
      setSummaryError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
      setSummaryLoading(false);
      return undefined;
    }

    let active = true;
    setSummaryLoading(true);
    setSummaryError("");
    const refresh = Date.now().toString();
    Promise.all(orderIds.map((id) => api.get(buildProductionReportSummaryUrl(id, fromDate, untilDate, refresh))))
      .then((results) => {
        if (active) setSummaryResults(results);
      })
      .catch((requestError) => {
        if (active) {
          setSummaryResults(null);
          setSummaryError(requestError.message || "Không thể tải tổng hợp sản lượng.");
        }
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => { active = false; };
  }, [orderIds.join(","), fromDate, untilDate, refreshToken]);

  function refreshData() {
    setError("");
    setRefreshToken((value) => value + 1);
  }

  async function exportReport() {
    setError("");
    if (!fromDate || !untilDate || fromDate > untilDate) {
      setError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
      return;
    }
    if (typeof api.download !== "function") {
      setError("Chức năng xuất báo cáo chưa sẵn sàng. Vui lòng tải lại trang.");
      return;
    }
    setExporting(true);
    try {
      await api.download(buildProductionReportExportUrl(fromDate, untilDate, orderIds), productionExportFileName(fromDate, untilDate, "bao-cao-san-luong"));
      toast.success("Đã tải báo cáo sản lượng.");
    } catch (requestError) {
      setError(requestError.message || "Không thể xuất báo cáo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="erp-feature-page">
      <PageHeader title="Báo cáo sản lượng" description="Chọn kỳ và mã sản xuất để xem tổng hợp theo công đoạn." />
      {error && <Alert variant="error" title="Không thể xuất báo cáo.">{error}</Alert>}
      {orderError && <Alert variant="error" title="Không thể tải danh sách Mã SX.">{orderError}</Alert>}
      <div className="erp-report-bar">
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
          customActions={customEditorVisible ? <div className="erp-period-custom-actions">
            {customError && <p className="erp-inline-message erp-inline-error" role="alert">{customError}</p>}
            <button type="button" className="erp-button erp-button-primary" onClick={submitCustomPeriod} disabled={Boolean(customError)}>Áp dụng</button>
          </div> : null}
        />
        <OrderMultiSelect orders={orders} productNames={productNames} selectedIds={orderIds} onChange={setOrderIds} loading={ordersLoading} />
        <span className="erp-report-bar-spacer" />
        <button
          className={`erp-square-button erp-report-refresh-button${refreshing ? " is-refreshing" : ""}`}
          type="button"
          onClick={refreshData}
          disabled={refreshing}
          aria-label="Làm mới dữ liệu"
          title={refreshing ? "Đang làm mới dữ liệu" : "Làm mới dữ liệu"}
          aria-busy={refreshing}
        >
          <Icon name="refresh" size={18} />
        </button>
        <button className="erp-button erp-button-primary" type="button" onClick={exportReport} disabled={exporting}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button>
      </div>
      {summaryError && <Alert variant="error" title="Không thể tải báo cáo công đoạn.">{summaryError}</Alert>}
      {summaryLoading && <div className="erp-report-state">Đang tải tổng hợp sản lượng...</div>}
      {!summaryLoading && !summaryError && orderIds.length === 0 && <div className="erp-report-state">Chọn Mã SX và khoảng ngày để xem sản lượng từng công đoạn.</div>}
      {!summaryLoading && !summaryError && orderIds.length > 0 && summary && summary.operations.length === 0 && <div className="erp-report-state">Mã SX này chưa có công đoạn.</div>}
      {!summaryLoading && !summaryError && summary && summary.operations.length > 0 && <ProductionOperationSummaryChart summary={summary} plannedQuantity={summary.plannedQuantity} />}
    </div>
  );
}
