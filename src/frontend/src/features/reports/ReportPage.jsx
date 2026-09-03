import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { productionExportFileName } from "../production-entries/productionExport.js";
import { localIsoDate } from "../production-entries/productionPeriod.js";
import { ProductionOperationSummaryChart } from "./ProductionOperationSummaryChart.jsx";
import { ProductionMonthlyOperationTable } from "./ProductionMonthlyOperationTable.jsx";

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

export function buildProductionMonthlySummaryUrl(orderId, fromMonth, untilMonth) {
  const params = new URLSearchParams({ orderId, fromMonth, untilMonth });
  return `/api/reports/production/monthly-summary?${params.toString()}`;
}

export function monthKeyFromDateRange(range) {
  return range.fromDate.slice(0, 7);
}

export function monthRangeToDateRange(fromMonth, untilMonth) {
  if (!/^\d{4}-\d{2}$/.test(fromMonth || "") || !/^\d{4}-\d{2}$/.test(untilMonth || "")) {
    return { fromDate: "", untilDate: "" };
  }
  const [fromYear, fromMonthNumber] = fromMonth.split("-").map(Number);
  const [untilYear, untilMonthNumber] = untilMonth.split("-").map(Number);
  const first = new Date(fromYear, fromMonthNumber - 1, 1, 12);
  const last = new Date(untilYear, untilMonthNumber, 0, 12);
  return { fromDate: localIsoDate(first), untilDate: localIsoDate(last) };
}

export function ReportPage() {
  const initialRange = currentReportMonthRange();
  const [fromMonth, setFromMonth] = useState(() => monthKeyFromDateRange(initialRange));
  const [untilMonth, setUntilMonth] = useState(() => monthKeyFromDateRange(initialRange));
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderError, setOrderError] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(false);
  const [monthlySummaryError, setMonthlySummaryError] = useState("");
  const toast = useToast();
  const { fromDate, untilDate } = monthRangeToDateRange(fromMonth, untilMonth);

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    api.get("/api/production-orders")
      .then((items) => {
        if (!active) return;
        setOrders(items);
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
    if (!orderId || !fromMonth || !untilMonth) {
      setSummary(null);
      setSummaryError("");
      setSummaryLoading(false);
      return undefined;
    }
    if (fromMonth > untilMonth) {
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
  }, [orderId, fromMonth, untilMonth, fromDate, untilDate]);

  useEffect(() => {
    if (!orderId || !fromMonth || !untilMonth) {
      setMonthlySummary(null);
      setMonthlySummaryError("");
      setMonthlySummaryLoading(false);
      return undefined;
    }
    if (fromMonth > untilMonth) {
      setMonthlySummary(null);
      setMonthlySummaryError("Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc.");
      setMonthlySummaryLoading(false);
      return undefined;
    }

    let active = true;
    setMonthlySummaryLoading(true);
    setMonthlySummaryError("");
    api.get(buildProductionMonthlySummaryUrl(orderId, fromMonth, untilMonth))
      .then((result) => {
        if (active) setMonthlySummary(result);
      })
      .catch((requestError) => {
        if (active) {
          setMonthlySummary(null);
          setMonthlySummaryError(requestError.message || "Không thể tải tổng hợp theo tháng.");
        }
      })
      .finally(() => {
        if (active) setMonthlySummaryLoading(false);
      });
    return () => { active = false; };
  }, [orderId, fromMonth, untilMonth]);

  async function exportReport() {
    setError("");
    if (!fromMonth || !untilMonth || fromMonth > untilMonth) {
      setError("Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc.");
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
        <Field label="Từ tháng"><input className="erp-control" type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} /></Field>
        <Field label="Đến tháng"><input className="erp-control" type="month" value={untilMonth} onChange={(event) => setUntilMonth(event.target.value)} /></Field>
        <button className="erp-button erp-button-primary" type="button" onClick={exportReport} disabled={exporting}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button>
      </div>
      {summaryError && <Alert variant="error" title="Không thể tải báo cáo công đoạn.">{summaryError}</Alert>}
      {monthlySummaryError && <Alert variant="error" title="Không thể tải tổng hợp theo tháng.">{monthlySummaryError}</Alert>}
      {(summaryLoading || monthlySummaryLoading) && <div className="erp-report-state">Đang tải tổng hợp sản lượng...</div>}
      {!summaryLoading && !summaryError && !orderId && <div className="erp-report-state">Chọn Mã SX và khoảng tháng để xem sản lượng từng công đoạn.</div>}
      {!summaryLoading && !summaryError && orderId && summary && summary.operations.length === 0 && <div className="erp-report-state">Mã SX này chưa có công đoạn.</div>}
      {!summaryLoading && !summaryError && summary && summary.operations.length > 0 && <ProductionOperationSummaryChart summary={summary} />}
      {!monthlySummaryLoading && !monthlySummaryError && monthlySummary && monthlySummary.operations.length > 0 && <ProductionMonthlyOperationTable summary={monthlySummary} />}
    </div>
  );
}
