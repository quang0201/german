import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { ProductionMonthlyOperationTable } from "./ProductionMonthlyOperationTable.jsx";
import { buildProductionMonthlySummaryUrl, currentReportMonthKey } from "./productionMonthlyReport.js";

export function ProductionMonthlyReportPage() {
  const initialMonth = currentReportMonthKey();
  const [fromMonth, setFromMonth] = useState(initialMonth);
  const [untilMonth, setUntilMonth] = useState(initialMonth);
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderError, setOrderError] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

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
    if (!orderId || !fromMonth || !untilMonth) {
      setSummary(null);
      setSummaryError("");
      setSummaryLoading(false);
      return undefined;
    }
    if (fromMonth > untilMonth) {
      setSummary(null);
      setSummaryError("Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc.");
      setSummaryLoading(false);
      return undefined;
    }

    let active = true;
    setSummaryLoading(true);
    setSummaryError("");
    api.get(buildProductionMonthlySummaryUrl(orderId, fromMonth, untilMonth))
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((requestError) => {
        if (active) {
          setSummary(null);
          setSummaryError(requestError.message || "Không thể tải tổng hợp theo tháng.");
        }
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => { active = false; };
  }, [orderId, fromMonth, untilMonth]);

  return (
    <div className="erp-feature-page">
      <PageHeader title="Báo cáo theo tháng" description="Xem tổng hợp theo tháng theo từng công đoạn." />
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
      </div>
      {summaryError && <Alert variant="error" title="Không thể tải tổng hợp theo tháng.">{summaryError}</Alert>}
      {summaryLoading && <div className="erp-report-state">Đang tải tổng hợp theo tháng...</div>}
      {!summaryLoading && !summaryError && !orderId && <div className="erp-report-state">Chọn Mã SX và khoảng tháng để xem sản lượng từng công đoạn.</div>}
      {!summaryLoading && !summaryError && orderId && summary && summary.operations.length === 0 && <div className="erp-report-state">Mã SX này chưa có công đoạn.</div>}
      {!summaryLoading && !summaryError && summary && summary.operations.length > 0 && <ProductionMonthlyOperationTable summary={summary} />}
    </div>
  );
}
