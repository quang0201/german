import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { productionExportFileName } from "../production-entries/productionExport.js";
import { localIsoDate } from "../production-entries/productionPeriod.js";
import { ProductionOperationSummaryChart } from "./ProductionOperationSummaryChart.jsx";

export function currentReportMonthRange(today = new Date()) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  return { fromDate: localIsoDate(first), untilDate: localIsoDate(last) };
}

export function buildProductionReportExportUrl(fromDate, untilDate) {
  const params = new URLSearchParams({ fromDate, untilDate });
  return `/api/reports/production/export.xlsx?${params.toString()}`;
}

export function buildProductionReportSummaryUrl(orderId, fromDate, untilDate) {
  const params = new URLSearchParams({ orderId, fromDate, untilDate });
  return `/api/reports/production/summary?${params.toString()}`;
}

export function ReportPage() {
  const initialRange = currentReportMonthRange();
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [untilDate, setUntilDate] = useState(initialRange.untilDate);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderError, setOrderError] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    api.get("/api/production-orders")
      .then((items) => {
        if (active) setOrders(items);
      })
      .catch((requestError) => {
        if (active) setOrderError(requestError.message || "Không thể tải danh sách Mã SX.");
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!orderId || !fromDate || !untilDate) {
      setSummary(null);
      setSummaryError("");
      setSummaryLoading(false);
      return undefined;
    }
    if (fromDate > untilDate) {
      setSummary(null);
      setSummaryError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
      setSummaryLoading(false);
      return undefined;
    }

    let active = true;
    setSummaryLoading(true);
    setSummaryError("");
    api.get(buildProductionReportSummaryUrl(orderId, fromDate, untilDate))
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((requestError) => {
        if (active) {
          setSummary(null);
          setSummaryError(requestError.message || "Không thể tải tổng hợp sản lượng.");
        }
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => { active = false; };
  }, [orderId, fromDate, untilDate]);

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
      await api.download(buildProductionReportExportUrl(fromDate, untilDate), productionExportFileName(fromDate, untilDate, "bao-cao-san-luong"));
      toast.success("Đã tải báo cáo sản lượng.");
    } catch (requestError) {
      setError(requestError.message || "Không thể xuất báo cáo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="erp-feature-page">
      <PageHeader title="Báo cáo" description="Xuất báo cáo sản lượng theo khoảng thời gian." />
      {error && <Alert variant="error" title="Không thể xuất báo cáo.">{error}</Alert>}
      {orderError && <Alert variant="error" title="Không thể tải danh sách Mã SX.">{orderError}</Alert>}
      <div className="erp-report-toolbar">
        <Field label="Mã SX">
          <select className="erp-control" value={orderId} onChange={(event) => setOrderId(event.target.value)} disabled={ordersLoading}>
            <option value="">{ordersLoading ? "Đang tải Mã SX..." : "Chọn Mã SX"}</option>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.code} — {order.productName}</option>)}
          </select>
        </Field>
        <Field label="Từ ngày"><input className="erp-control" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></Field>
        <Field label="Đến ngày"><input className="erp-control" type="date" value={untilDate} onChange={(event) => setUntilDate(event.target.value)} /></Field>
        <button className="erp-button erp-button-primary" type="button" onClick={exportReport} disabled={exporting}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button>
      </div>
      {summaryError && <Alert variant="error" title="Không thể tải báo cáo công đoạn.">{summaryError}</Alert>}
      {summaryLoading && <div className="erp-report-state">Đang tải tổng hợp sản lượng...</div>}
      {!summaryLoading && !summaryError && !orderId && <div className="erp-report-state">Chọn Mã SX và khoảng ngày để xem sản lượng từng công đoạn.</div>}
      {!summaryLoading && !summaryError && orderId && summary && summary.operations.length === 0 && <div className="erp-report-state">Mã SX này chưa có công đoạn.</div>}
      {!summaryLoading && !summaryError && summary && summary.operations.length > 0 && <ProductionOperationSummaryChart summary={summary} />}
    </div>
  );
}
