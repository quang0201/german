import React, { useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { Field } from "../../components/erp/Field.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { useToast } from "../../components/erp/ToastProvider.jsx";
import { api } from "../../lib/api.js";

function localToday() { return new Date().toISOString().slice(0, 10); }
export function ReportPage() { const [fromDate, setFromDate] = useState(localToday()); const [untilDate, setUntilDate] = useState(localToday()); const [error, setError] = useState(""); const toast = useToast(); async function exportReport() { setError(""); try { await api.download(`/api/reports/production/export.xlsx?fromDate=${encodeURIComponent(fromDate)}&untilDate=${encodeURIComponent(untilDate)}`, "bao-cao-san-luong.xlsx"); toast.success("Đã tải báo cáo sản lượng."); } catch (e) { setError(e.message || "Không thể xuất báo cáo."); } } return <div className="erp-feature-page"><PageHeader title="Báo cáo" description="Xuất báo cáo sản lượng theo khoảng thời gian." />{error && <Alert variant="error" title="Không thể xuất báo cáo.">{error}</Alert>}<div className="erp-report-toolbar"><Field label="Từ ngày"><input className="erp-control" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field><Field label="Đến ngày"><input className="erp-control" type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} /></Field><button className="erp-button erp-button-primary" type="button" onClick={exportReport}>Xuất Excel</button></div></div>; }
