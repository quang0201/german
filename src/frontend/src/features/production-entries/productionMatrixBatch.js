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

export function mergeAttendanceHourDraft(current, attendance, dirty = {}) {
  const hasAttendance = Boolean(attendance?.hasAttendance);
  const incomingShifts = attendance?.shifts ?? [];
  const dirtyShifts = dirty.shifts ?? {};

  return {
    hcHours: dirty.hcHours
      ? current.hcHours
      : (hasAttendance ? String(attendance.regularHours ?? "") : ""),
    tcHours: dirty.tcHours
      ? current.tcHours
      : (hasAttendance ? String(attendance.overtimeHours ?? "") : ""),
    shifts: incomingShifts.map((shift) => {
      const slotKey = String(shift.slotNumber);
      const currentShift = (current.shifts ?? []).find(
        (item) => String(item.slotNumber) === slotKey,
      );
      return {
        ...shift,
        workedHours: dirtyShifts[slotKey]
          ? currentShift?.workedHours ?? ""
          : String(shift.workedHours ?? ""),
      };
    }),
  };
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

export function buildBatchDirectPayload({ workDate, employeeId, productionOrderId, hourDraft, items }) {
  const shifts = (hourDraft?.shifts ?? []).map((shift) => ({
    slotNumber: shift.slotNumber,
    kind: "Hours",
    workedHours: requiredHours(shift.workedHours, shift.shiftName || `Ca ${shift.slotNumber}`),
  }));

  const payload = {
    workDate,
    employeeId,
    productionOrderId,
    items,
  };

  if (!hourDraft) return payload;

  return {
    ...payload,
    attendance: {
      employeeId,
      workDate,
      overtimeHours: requiredHours(hourDraft?.tcHours ?? 0, "TC"),
      shifts,
    },
  };
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

function requiredHours(value, label) {
  if (value === "" || value === null || value === undefined) return 0;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) throw new RangeError(`${label} phải là số giờ không âm.`);
  return hours;
}
import { calculateHourSplitPreview, calculateMultiShiftHourSplit } from "./productionMatrixHourSplit.js";
