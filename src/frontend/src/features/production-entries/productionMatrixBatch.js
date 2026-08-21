export function isCurrentBatchOperationsRequest(active, requestedOrderId, currentOrderId) {
  return active && String(requestedOrderId ?? "") === String(currentOrderId ?? "");
}

export function isCurrentBatchOrdersRequest(active, requestedDay, currentDay) {
  return active
    && requestedDay?.isoDate === currentDay?.isoDate
    && String(requestedDay?.preferredOrderId ?? "") === String(currentDay?.preferredOrderId ?? "");
}

export function isCurrentAttendanceRequest(
  active,
  requestedEmployeeId,
  requestedDate,
  currentEmployeeId,
  currentDate,
) {
  return active
    && String(requestedEmployeeId ?? "") === String(currentEmployeeId ?? "")
    && requestedDate === currentDate;
}

export function resolveBatchEntryQuantities({ mode, draft, hourDraft }) {
  if (mode === "direct") {
    return {
      hc: requiredQuantity(draft.hc, "HC"),
      tc: requiredQuantity(draft.tc, "TC"),
    };
  }

  const preview = mode === "attendance-shifts"
    ? calculateMultiShiftHourSplit({
      shifts: hourDraft.shifts,
      overtimeHours: hourDraft.tcHours,
      totalExpression: draft.total,
    })
    : calculateHourSplitPreview({
      hcHours: hourDraft.hcHours,
      tcHours: hourDraft.tcHours,
      totalExpression: draft.total,
    });

  return { hc: preview.hc, tc: preview.tc, preview };
}

function requiredQuantity(value, label) {
  if (value === "" || value === null || value === undefined) {
    throw new RangeError(`${label} không được để trống.`);
  }
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError(`${label} phải là số không âm.`);
  }
  return quantity;
}
import { calculateHourSplitPreview, calculateMultiShiftHourSplit } from "./productionMatrixHourSplit.js";
