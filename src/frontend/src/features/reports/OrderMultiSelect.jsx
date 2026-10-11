import React, { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "../../lib/useEscapeKey.js";
import { MAX_REPORT_ORDERS, groupOrdersByProduct, toggleGroupSelection, toggleOrderSelection } from "./productionOperationMerge.js";

function triggerText(orders, selectedIds, loading) {
  if (selectedIds.length === 0) return loading ? "Đang tải Mã SX..." : "Chọn Mã SX";
  const first = orders.find((order) => String(order.id) === String(selectedIds[0]));
  const label = first ? first.code : "Mã SX";
  if (selectedIds.length === 1) return first ? `${first.code} — ${first.productName}` : label;
  return `${label} +${selectedIds.length - 1}`;
}

export function OrderMultiSelect({ orders = [], productNames = {}, selectedIds = [], onChange, loading = false, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const rootRef = useRef(null);
  const groups = groupOrdersByProduct(orders, productNames);
  const atLimit = selectedIds.length >= MAX_REPORT_ORDERS;

  useEscapeKey(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsidePress(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [open]);

  return (
    <div className="erp-order-picker" ref={rootRef}>
      <button type="button" className="erp-pill erp-period-trigger" aria-label="Mã SX" aria-expanded={open} aria-haspopup="true" disabled={loading} onClick={() => setOpen((value) => !value)}>
        <span className="erp-pill-label">Mã SX</span>
        <b>{triggerText(orders, selectedIds, loading)}</b>
        <span className="erp-pill-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="erp-period-popover erp-order-popover" role="group" aria-label="Chọn Mã SX">
          <p className="erp-order-popover-hint">Chọn nhiều mã để cộng gộp theo số công đoạn (tối đa {MAX_REPORT_ORDERS}).{atLimit ? " Đã chọn tối đa." : ""}</p>
          {groups.map((group) => {
            const allSelected = group.orderIds.every((id) => selectedIds.includes(id));
            return (
              <fieldset className="erp-order-group" key={group.key || "none"}>
                <legend>
                  <label>
                    <input type="checkbox" checked={allSelected} onChange={() => onChange?.(toggleGroupSelection(selectedIds, group.orderIds))} />
                    <strong>{group.label}</strong>
                  </label>
                </legend>
                {group.orders.map((order) => (
                  <label className="erp-order-option" key={order.id}>
                    <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => onChange?.(toggleOrderSelection(selectedIds, order.id))} />
                    <span>{order.code}</span>
                    <small>{order.productName}</small>
                  </label>
                ))}
              </fieldset>
            );
          })}
          {groups.length === 0 && <p className="erp-order-popover-hint">Chưa có Mã SX.</p>}
        </div>
      )}
    </div>
  );
}
