import React, { useState } from "react";

function quantity(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function monthLabel(month) {
  const [year, monthNumber] = String(month.monthKey || "").split("-");
  return year && monthNumber ? `${monthNumber}/${year}` : month.monthKey;
}

function monthValue(operation, monthKey) {
  return operation.months?.find((item) => item.monthKey === monthKey) || {
    hcQuantity: 0,
    tcQuantity: 0,
    totalQuantity: 0,
    externalQuantity: 0,
    combinedTotalQuantity: 0,
  };
}

function totalValue(value) {
  const combinedTotal = Number(value.combinedTotalQuantity);
  if (Number.isFinite(combinedTotal)) return combinedTotal;

  const backendTotal = Number(value.totalQuantity);
  if (Number.isFinite(backendTotal)) return backendTotal + externalValue(value);

  return Number(value.hcQuantity || 0) + Number(value.tcQuantity || 0) + externalValue(value);
}

function externalValue(value) {
  const external = Number(value.externalQuantity);
  return Number.isFinite(external) ? external : 0;
}

function QuantityCell({ value, unit, showBreakdown, emphasized = false }) {
  const total = totalValue(value);
  const className = [
    "erp-report-monthly-metric",
    total === 0 ? "is-zero" : "",
    emphasized ? "is-emphasized" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <strong className="erp-report-monthly-total">
        {total === 0 ? "—" : quantity(total)} <small>{unit}</small>
      </strong>
      {showBreakdown && (
        <span className="erp-report-monthly-split">
          HC {quantity(value.hcQuantity)} · TC {quantity(value.tcQuantity)}
          {externalValue(value) > 0 && ` · Ngoài ${quantity(externalValue(value))}`}
        </span>
      )}
    </div>
  );
}

export function ProductionMonthlyOperationTable({ summary, initialShowBreakdown = true }) {
  const [showBreakdown, setShowBreakdown] = useState(initialShowBreakdown);
  const months = summary?.months || [];
  const operations = summary?.operations || [];

  return (
    <section className="erp-report-monthly-card" aria-label="Tổng hợp sản lượng theo tháng">
      <div className="erp-report-monthly-card-header">
        <div>
          <span className="erp-report-eyebrow">Theo dõi tiến độ</span>
          <h2>Tổng hợp theo tháng</h2>
        </div>
        <div className="erp-report-monthly-toolbar">
          <span>{months.length} tháng · {operations.length} công đoạn</span>
          <div className="erp-report-monthly-view-toggle" role="group" aria-label="Cách hiển thị sản lượng">
            <button
              type="button"
              className={`erp-button erp-button-small ${showBreakdown ? "is-active" : ""}`}
              aria-pressed={showBreakdown}
              onClick={() => setShowBreakdown(true)}
            >
              Tổng + HC/TC + Ngoài
            </button>
            <button
              type="button"
              className={`erp-button erp-button-small ${!showBreakdown ? "is-active" : ""}`}
              aria-pressed={!showBreakdown}
              onClick={() => setShowBreakdown(false)}
            >
              Chỉ tổng
            </button>
          </div>
        </div>
      </div>
      <div className="erp-report-monthly-table-wrap">
        <table className="erp-report-monthly-table">
          <caption className="erp-visually-hidden">Sản lượng từng công đoạn theo tháng</caption>
          <thead>
            <tr>
              <th scope="col">Công đoạn</th>
              {months.map((month, index) => (
                <th scope="col" className={index === months.length - 1 ? "is-latest" : ""} key={month.monthKey}>
                  {monthLabel(month)}
                </th>
              ))}
              <th scope="col" className="is-cumulative">Lũy kế</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => (
              <tr key={operation.operationId || operation.operationNumber}>
                <th scope="row">
                  <strong>CĐ{operation.operationNumber}</strong>
                  <span>{operation.name}</span>
                </th>
                {months.map((month, index) => (
                  <td key={month.monthKey} className={index === months.length - 1 ? "is-latest" : ""}>
                    <QuantityCell
                      value={monthValue(operation, month.monthKey)}
                      unit={operation.unit}
                      showBreakdown={showBreakdown}
                      emphasized={index === months.length - 1}
                    />
                  </td>
                ))}
                <td className="is-cumulative">
                  <QuantityCell
                    value={operation}
                    unit={operation.unit}
                    showBreakdown={showBreakdown}
                    emphasized
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
