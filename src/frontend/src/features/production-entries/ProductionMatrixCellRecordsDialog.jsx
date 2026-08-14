import React from "react";
import { entryModeLabel } from "../../lib/i18n.js";

const format = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function ProductionMatrixCellRecordsDialog({ context, onClose, onOpenEntry }) {
  if (!context?.cell || context.cell.entryCount <= 1) return null;
  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section className="erp-dialog erp-matrix-dialog" role="dialog" aria-modal="true" aria-labelledby="matrix-records-title">
        <h2 id="matrix-records-title">Các bản ghi trong ô</h2>
        <div className="erp-dialog-body">
          <p>{context.employee.employeeName} · Mã SX {context.order.orderCode} · CĐ{context.operation.operationNumber} · {context.workDate.split("-").reverse().join("/")}</p>
          <div className="erp-matrix-record-list">
            {context.cell.records.map((record) => (
              <button key={record.id} type="button" className="erp-matrix-record-item" onClick={() => onOpenEntry?.(record.id)}>
                <strong>{entryModeLabel(record.entryMode)}</strong>
                <span>HC {format.format(record.hcQuantity)} · TC {format.format(record.tcQuantity)} · Tổng {format.format(record.totalQuantity)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="erp-dialog-actions"><button type="button" className="erp-button erp-button-secondary" onClick={onClose}>Đóng</button></div>
      </section>
    </div>
  );
}
