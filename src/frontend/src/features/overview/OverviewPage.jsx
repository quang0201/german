import React, { useEffect, useState } from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { api } from "../../lib/api.js";
import { navigate } from "../../app/navigation.js";

export function OverviewPage() { const [data, setData] = useState({ items: [] }); const [error, setError] = useState(""); useEffect(() => { api.get("/api/production-entries?date=" + new Date().toISOString().slice(0, 10) + "&page=1&pageSize=50").then(setData).catch((e) => setError(e.message || "Không thể tải tổng quan.")); }, []); const total = data.items.reduce((sum, row) => sum + Number(row.totalQuantity || 0), 0); return <div className="erp-feature-page"><PageHeader title="Tổng quan" description="Các chỉ số và việc cần xử lý trong ngày." actions={<button className="erp-button erp-button-primary" type="button" onClick={() => navigate("/production")}>Mở sản lượng</button>} />{error && <Alert variant="error" title="Không thể tải tổng quan.">{error}</Alert>}<div className="erp-summary-grid"><div><span>Sản lượng hôm nay</span><strong>{total}</strong></div><div><span>Số bản ghi</span><strong>{data.totalCount ?? 0}</strong></div><div><span>Trang dữ liệu</span><strong>{data.totalPages ?? 0}</strong></div></div></div>; }
