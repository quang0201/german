import React from "react";

function quantity(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export function ProductionOperationSummaryChart({ summary }) {
  const operations = summary?.operations || [];
  const groups = [...operations.reduce((byUnit, operation) => {
    const unit = operation.unit || "Không xác định";
    const group = byUnit.get(unit) || [];
    group.push(operation);
    byUnit.set(unit, group);
    return byUnit;
  }, new Map())];

  return (
    <section className="erp-report-summary-card" aria-label="Tóm tắt sản lượng theo công đoạn">
      <div className="erp-report-summary-card-header">
        <div>
          <span className="erp-report-eyebrow">Mã sản xuất</span>
          <h2>{summary.orderCode} — {summary.productName}</h2>
        </div>
        <strong>{summary.operationCount} công đoạn</strong>
      </div>
      <div className="erp-report-operation-chart" aria-label="Biểu đồ sản lượng từng công đoạn">
        {groups.map(([unit, unitOperations]) => {
          const maxTotal = Math.max(...unitOperations.map((operation) => Number(operation.totalQuantity || 0)), 0);
          return (
            <section className="erp-report-operation-unit-group" key={unit} aria-label={`Đơn vị: ${unit}`}>
              <div role="list">
                {unitOperations.map((operation) => {
                  const total = Number(operation.totalQuantity || 0);
                  const hc = Number(operation.hcQuantity || 0);
                  const tc = Number(operation.tcQuantity || 0);
                  const hcWidth = maxTotal > 0 ? Math.max(0, Math.min(100, (hc / maxTotal) * 100)) : 0;
                  const tcWidth = maxTotal > 0 ? Math.max(0, Math.min(100, (tc / maxTotal) * 100)) : 0;
                  return (
                    <div className="erp-report-operation-row" role="listitem" key={operation.operationId || operation.operationNumber}>
                      <div className="erp-report-operation-label">
                        <strong>CĐ{operation.operationNumber}</strong>
                        <span>{operation.name}</span>
                      </div>
                      <div className="erp-report-operation-bar-wrap">
                        <div
                          className="erp-report-operation-bar"
                          title={`HC: ${quantity(hc)} | TC: ${quantity(tc)} | Tổng: ${quantity(total)} ${unit}`}
                          aria-label={`CĐ${operation.operationNumber}: HC ${quantity(hc)}, TC ${quantity(tc)}, Tổng ${quantity(total)} ${unit}`}
                        >
                          <span className="erp-report-operation-bar-hc" style={{ width: `${hcWidth}%` }} />
                          <span className="erp-report-operation-bar-tc" style={{ width: `${tcWidth}%` }} />
                        </div>
                        <div className="erp-report-operation-details">
                          <span>HC: {quantity(hc)}</span>
                          <span>TC: {quantity(tc)}</span>
                          <strong>Tổng: {quantity(total)} {unit}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
