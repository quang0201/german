import React from "react";

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

function QuantityCell({ value }) {
  return (
    <div className="erp-report-monthly-quantity-cell">
      <span>HC: {quantity(value.hcQuantity)}</span>
      <strong>TC: {quantity(value.tcQuantity)}</strong>
    </div>
  );
}

export function ProductionMonthlyOperationTable({ summary }) {
  const months = summary?.months || [];
  const operations = summary?.operations || [];

  return (
    <section className="erp-report-monthly-card" aria-label="Tổng hợp sản lượng theo tháng">
      <div className="erp-report-monthly-card-header">
        <div>
          <span className="erp-report-eyebrow">Theo dõi tiến độ</span>
          <h2>Tổng hợp theo tháng</h2>
        </div>
        <span>{months.length} tháng · {operations.length} công đoạn</span>
      </div>
      <div className="erp-report-monthly-table-wrap">
        <table className="erp-report-monthly-table">
          <caption className="erp-visually-hidden">Sản lượng từng công đoạn theo tháng</caption>
          <thead>
            <tr>
              <th scope="col">Công đoạn</th>
              {months.map((month) => <th scope="col" key={month.monthKey}>{monthLabel(month)}</th>)}
              <th scope="col">Tổng HC/TC</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => (
              <tr key={operation.operationId || operation.operationNumber}>
                <th scope="row"><strong>CĐ{operation.operationNumber}</strong><span>{operation.name}</span></th>
                {months.map((month) => <td key={month.monthKey}><QuantityCell value={monthValue(operation, month.monthKey)} /></td>)}
                <td><QuantityCell value={operation} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
