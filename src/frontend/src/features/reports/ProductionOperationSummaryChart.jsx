import React from "react";
import { isOverProductionPlan, productionPlanLimit } from "./productionPlanStatus.js";
import { ProductionPlanIndicator } from "./ProductionPlanIndicator.jsx";

function quantity(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function operationTotal(operation) {
  const internal = Number(operation.totalQuantity || 0);
  const external = Number(operation.externalQuantity || 0);
  return Number(operation.combinedTotalQuantity ?? (internal + external));
}

function progressWidth(value, scale) {
  if (scale <= 0) return 0;
  return Math.max(0, Math.min(100, (value / scale) * 100));
}

export function Quantity({ value, unit, emptyAsDash = false, total = false, isOverPlan = false, planLimit = null }) {
  const amount = Number(value || 0);

  return (
    <div
      className={`erp-report-number ${total ? "is-total" : ""} ${isOverPlan ? "is-over-plan" : ""} ${emptyAsDash && amount === 0 ? "is-empty" : ""}`}
      role="cell"
      title={isOverPlan ? `Vượt kế hoạch (ngưỡng ${quantity(planLimit)})` : undefined}
    >
      <strong>{emptyAsDash && amount === 0 ? "—" : quantity(amount)}</strong>
      {!(emptyAsDash && amount === 0) && <small>{unit}</small>}
      {isOverPlan && <span className="erp-report-plan-alert">Vượt kế hoạch</span>}
    </div>
  );
}

export function ProductionOperationRow({ operation, maxQuantity, plannedQuantity }) {
  const hc = Number(operation.hcQuantity || 0);
  const tc = Number(operation.tcQuantity || 0);
  const internal = Number(operation.totalQuantity || 0);
  const external = Number(operation.externalQuantity || 0);
  const total = operationTotal(operation);
  const scale = maxQuantity || 1;
  const unit = operation.unit || "";
  const planLimit = productionPlanLimit(plannedQuantity);
  const isOverPlan = isOverProductionPlan(total, plannedQuantity);

  return (
    <div className={`erp-report-operation-row ${isOverPlan ? "is-over-plan" : ""}`} role="row">
      <div className="erp-report-operation-label" role="cell">
        <strong>CĐ{operation.operationNumber}</strong>
        <span title={operation.name}>{operation.name}</span>
      </div>

      <div className="erp-report-operation-progress" role="cell">
        <div
          className="erp-report-operation-bar"
          title={`HC: ${quantity(hc)} | TC: ${quantity(tc)} | Nội bộ: ${quantity(internal)} | Bên ngoài: ${quantity(external)} | Tổng: ${quantity(total)} ${unit}`}
          aria-label={`CĐ${operation.operationNumber}: HC ${quantity(hc)}, TC ${quantity(tc)}, Nội bộ ${quantity(internal)}, Bên ngoài ${quantity(external)}, Tổng ${quantity(total)} ${unit}`}
        >
          <span className="erp-report-operation-bar-hc" style={{ width: `${progressWidth(hc, scale)}%` }} />
          <span className="erp-report-operation-bar-tc" style={{ width: `${progressWidth(tc, scale)}%` }} />
          <span className="erp-report-operation-bar-external" style={{ width: `${progressWidth(external, scale)}%` }} />
        </div>
        <div className="erp-report-operation-split">
          <span>HC {quantity(hc)}</span>
          <span>TC {quantity(tc)}</span>
        </div>
      </div>

      <Quantity value={internal} unit={unit} />
      <Quantity value={external} unit={unit} emptyAsDash />
      <Quantity value={total} unit={unit} total isOverPlan={isOverPlan} planLimit={planLimit} />
    </div>
  );
}

export function ProductionOperationSummaryChart({ summary, plannedQuantity }) {
  const operations = summary?.operations || [];
  const maxByUnit = operations.reduce((maxima, operation) => {
    const unit = operation.unit || "Không xác định";
    maxima[unit] = Math.max(maxima[unit] || 0, operationTotal(operation));
    return maxima;
  }, {});

  return (
    <section className="erp-report-summary-card" aria-label="Tóm tắt sản lượng theo công đoạn">
      <div className="erp-report-summary-card-header">
        <div>
          <span className="erp-report-eyebrow">Mã sản xuất</span>
          <h2>{summary.orderCode} — {summary.productName}</h2>
        </div>
        <div className="erp-report-summary-card-meta">
          <strong>{summary.operationCount} công đoạn</strong>
          <ProductionPlanIndicator plannedQuantity={plannedQuantity} />
          <div className="erp-report-operation-legend" aria-label="Chú giải biểu đồ">
            <span><i className="erp-report-operation-legend-swatch erp-report-operation-bar-hc" /> HC</span>
            <span><i className="erp-report-operation-legend-swatch erp-report-operation-bar-tc" /> TC</span>
            <span><i className="erp-report-operation-legend-swatch erp-report-operation-bar-external" /> Bên ngoài</span>
          </div>
        </div>
      </div>

      <div className="erp-report-operation-table-wrap">
        <div className="erp-report-operation-table" role="table" aria-label="Sản lượng từng công đoạn">
          <div className="erp-report-operation-table-header" role="row">
            <span role="columnheader">Công đoạn</span>
            <span role="columnheader">Cơ cấu sản lượng</span>
            <span role="columnheader">Nội bộ</span>
            <span role="columnheader">Bên ngoài</span>
            <span role="columnheader">Tổng</span>
          </div>
          <div role="rowgroup">
            {operations.map((operation) => (
              <ProductionOperationRow
                key={operation.operationId || operation.operationNumber}
                operation={operation}
                maxQuantity={maxByUnit[operation.unit || "Không xác định"]}
                plannedQuantity={plannedQuantity}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="erp-report-table-scroll-hint">Kéo ngang để xem đầy đủ các cột.</p>
    </section>
  );
}
