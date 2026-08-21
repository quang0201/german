import React, { useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";
import { productionExportFileName } from "../production-entries/productionExport.js";

function localToday() { return new Date().toISOString().slice(0, 10); }

export function buildProductionReportExportUrl(fromDate, untilDate) {
  const params = new URLSearchParams({ fromDate, untilDate });
  return `/api/reports/production/export.xlsx?${params.toString()}`;
}

export function ReportPage() {
  const [fromDate, setFromDate] = useState(localToday());
  const [untilDate, setUntilDate] = useState(localToday());
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

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
      <div className="erp-report-toolbar">
        <Field label="Từ ngày"><input className="erp-control" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></Field>
        <Field label="Đến ngày"><input className="erp-control" type="date" value={untilDate} onChange={(event) => setUntilDate(event.target.value)} /></Field>
        <button className="erp-button erp-button-primary" type="button" onClick={exportReport} disabled={exporting}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button>
      </div>
    </div>
  );
}
