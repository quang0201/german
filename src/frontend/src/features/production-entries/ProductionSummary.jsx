import React from "react";

const vietnameseNumber = new Intl.NumberFormat("vi-VN", {
  useGrouping: true,
  maximumFractionDigits: 2,
});

function formatSummaryValue(value) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? vietnameseNumber.format(numericValue) : "0";
}

export function ProductionSummary({ summary = {}, operationSelected }) {
  const metrics = [
    ["Nhân viên", formatSummaryValue(summary.employeeCount)],
    ["Bản ghi", formatSummaryValue(summary.entryCount)],
    ["HC", formatSummaryValue(summary.hcQuantity)],
    ["TC", formatSummaryValue(summary.tcQuantity)],
    [operationSelected ? "Tổng sản lượng" : "Tổng lượt công đoạn", formatSummaryValue(summary.totalQuantity)],
  ];

  return (
    <section className="erp-production-summary" aria-label="Tóm tắt sản lượng">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}
