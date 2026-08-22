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
      <div className="erp-report-operation-legend" aria-label="Chú giải biểu đồ">
        <span><i className="erp-report-operation-legend-swatch erp-report-operation-bar-hc" /> HC</span>
        <span><i className="erp-report-operation-legend-swatch erp-report-operation-bar-tc" /> TC</span>
        <span><i className="erp-report-operation-legend-swatch erp-report-operation-bar-external" /> Bên ngoài</span>
      </div>
      <div className="erp-report-operation-chart" aria-label="Biểu đồ sản lượng từng công đoạn">
        {groups.map(([unit, unitOperations]) => {
          const maxTotal = Math.max(...unitOperations.map((operation) => Number(operation.combinedTotalQuantity ?? (Number(operation.totalQuantity || 0) + Number(operation.externalQuantity || 0)))), 0);
          return (
            <section className="erp-report-operation-unit-group" key={unit} aria-label={`Đơn vị: ${unit}`}>
              <div role="list">
                {unitOperations.map((operation) => {
                  const total = Number(operation.totalQuantity || 0);
                  const hc = Number(operation.hcQuantity || 0);
                  const tc = Number(operation.tcQuantity || 0);
                  const external = Number(operation.externalQuantity || 0);
                  const combinedTotal = Number(operation.combinedTotalQuantity ?? (total + external));
                  const hcWidth = maxTotal > 0 ? Math.max(0, Math.min(100, (hc / maxTotal) * 100)) : 0;
                  const tcWidth = maxTotal > 0 ? Math.max(0, Math.min(100, (tc / maxTotal) * 100)) : 0;
                  const externalWidth = maxTotal > 0 ? Math.max(0, Math.min(100, (external / maxTotal) * 100)) : 0;
                  return (
                    <div className="erp-report-operation-row" role="listitem" key={operation.operationId || operation.operationNumber}>
                      <div className="erp-report-operation-label">
                        <strong>CĐ{operation.operationNumber}</strong>
                        <span>{operation.name}</span>
                      </div>
                      <div className="erp-report-operation-bar-wrap">
                        <div
                          className="erp-report-operation-bar"
                          title={`HC: ${quantity(hc)} | TC: ${quantity(tc)} | Nội bộ: ${quantity(total)} | Bên ngoài: ${quantity(external)} | Tổng: ${quantity(combinedTotal)} ${unit}`}
                          aria-label={`CĐ${operation.operationNumber}: HC ${quantity(hc)}, TC ${quantity(tc)}, Nội bộ ${quantity(total)}, Bên ngoài ${quantity(external)}, Tổng ${quantity(combinedTotal)} ${unit}`}
                        >
                          <span className="erp-report-operation-bar-hc" style={{ width: `${hcWidth}%` }} />
                          <span className="erp-report-operation-bar-tc" style={{ width: `${tcWidth}%` }} />
                          <span className="erp-report-operation-bar-external" style={{ width: `${externalWidth}%` }} />
                        </div>
                        <div className="erp-report-operation-details">
                          <span>HC: {quantity(hc)}</span>
                          <span>TC: {quantity(tc)}</span>
                          <span>Nội bộ: {quantity(total)}</span>
                          <span>Bên ngoài: {quantity(external)}</span>
                          <strong>Tổng: {quantity(combinedTotal)} {unit}</strong>
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
