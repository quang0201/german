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

export function parseAttendanceShiftValue(value, label) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "P") return { kind: "PaidLeave", workedHours: null };
  if (normalized === "Ô") return { kind: "SickLeave", workedHours: null };
  return {
    kind: "Hours",
    workedHours: requiredHours(value, label),
  };
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
      : (hasAttendance
        ? String(attendance.overtimeHours ?? "0")
        : (current.tcHours === "" || current.tcHours === null || current.tcHours === undefined ? "0" : current.tcHours)),
    shifts: incomingShifts.map((shift) => {
      const slotKey = String(shift.slotNumber);
      const currentShift = (current.shifts ?? []).find(
        (item) => String(item.slotNumber) === slotKey,
      );
      return {
        ...shift,
        workedHours: dirtyShifts[slotKey]
          ? currentShift?.workedHours ?? ""
          : String(hasAttendance ? (shift.workedHours ?? "0") : "4"),
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
      shifts: normalizeProductionShifts(hourDraft),
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

export function buildAttendanceMonthPayload({ workDate, employeeId, hourDraft, useTotalRegularHours = false }) {
  const shifts = buildAttendanceShifts(hourDraft, useTotalRegularHours);
  const [year, month] = String(workDate).split("-").map(Number);
  return {
    year,
    month,
    days: [{
      employeeId,
      workDate,
      overtimeHours: requiredHours(hourDraft?.tcHours ?? 0, "TC"),
      shifts,
    }],
  };
}

export function buildBatchDirectPayload({ workDate, employeeId, productionOrderId, hourDraft, useTotalRegularHours = false, items }) {
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
      ...buildAttendanceMonthPayload({ workDate, employeeId, hourDraft, useTotalRegularHours }).days[0],
    },
  };
}

function buildAttendanceShifts(hourDraft, useTotalRegularHours) {
  const sourceShifts = hourDraft?.shifts ?? [];
  const parsedShifts = sourceShifts.map((shift) => ({
    source: shift,
    value: parseAttendanceShiftValue(
      shift.kind === "PaidLeave" ? "P" : shift.kind === "SickLeave" ? "Ô" : shift.workedHours,
      shift.shiftName || `Ca ${shift.slotNumber}`,
    ),
  }));
  if (!useTotalRegularHours) {
    return parsedShifts.map(({ source, value }) => ({ slotNumber: source.slotNumber, ...value }));
  }

  const totalHours = requiredHours(hourDraft?.hcHours ?? 0, "Giờ HC");
  if (!sourceShifts.length) return [];
  const workingShifts = parsedShifts.filter(({ value }) => value.kind === "Hours");
  if (!workingShifts.length) {
    if (totalHours > 0) throw new RangeError("Không thể phân bổ giờ HC cho các ca nghỉ.");
    return parsedShifts.map(({ source, value }) => ({ slotNumber: source.slotNumber, ...value }));
  }
  const weights = workingShifts.map(({ source }) => {
    const scheduledHours = Number(source.scheduledHours);
    return Number.isFinite(scheduledHours) && scheduledHours > 0 ? scheduledHours : 1;
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;
  let workingIndex = 0;
  return parsedShifts.map(({ source, value }) => {
    if (value.kind !== "Hours") return { slotNumber: source.slotNumber, ...value };
    const workedHours = workingIndex === workingShifts.length - 1
      ? totalHours - assigned
      : totalHours * weights[workingIndex] / weightTotal;
    assigned += workedHours;
    workingIndex += 1;
    return { slotNumber: source.slotNumber, kind: "Hours", workedHours };
  });
}

function normalizeProductionShifts(hourDraft) {
  return (hourDraft?.shifts ?? []).map((shift) => {
    const value = parseAttendanceShiftValue(
      shift.kind === "PaidLeave" ? "P" : shift.kind === "SickLeave" ? "Ô" : shift.workedHours,
      shift.shiftName || `Ca ${shift.slotNumber}`,
    );
    return { ...shift, workedHours: value.kind === "Hours" ? value.workedHours : 0 };
  });
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
  if (!Number.isFinite(hours) || hours < 0) throw new RangeError(`${label} phải là số giờ không âm, P hoặc Ô.`);
  return hours;
}
import { calculateHourSplitPreview, calculateMultiShiftHourSplit } from "./productionMatrixHourSplit.js";
