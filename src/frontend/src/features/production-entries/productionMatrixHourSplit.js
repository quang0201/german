import { roundQuantity } from "./productionCalculation.js";

const TERM_PATTERN = /^\d+(?:\.\d+)?$/;

function requireNonNegativeNumber(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new RangeError(`${label} không được để trống.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError(`${label} phải là số không âm.`);
  }
  return parsed;
}

export function parseProductionExpression(expression) {
  const source = String(expression ?? "").trim();
  if (!source) throw new RangeError("Tổng sản lượng không được để trống.");

  const rawTerms = source.split("+");
  if (rawTerms.some((term) => !term.trim() || !TERM_PATTERN.test(term.trim()))) {
    throw new RangeError("Tổng sản lượng chỉ được dùng các số không âm và phép cộng.");
  }

  const terms = rawTerms.map((term) => Number(term.trim()));
  const total = terms.reduce((sum, term) => sum + term, 0);
  if (!Number.isFinite(total)) throw new RangeError("Tổng sản lượng không hợp lệ.");
  return { terms, total };
}

export function calculateHourSplitPreview({ hcHours, tcHours, totalExpression }) {
  const normalizedHcHours = requireNonNegativeNumber(hcHours, "Giờ HC");
  const normalizedTcHours = requireNonNegativeNumber(tcHours, "Giờ TC");
  const preview = calculateMultiShiftHourSplit({
    shifts: [{ slotNumber: 0, shiftName: "HC", workedHours: normalizedHcHours }],
    overtimeHours: normalizedTcHours,
    totalExpression,
  });
  return {
    total: preview.total,
    totalHours: preview.totalHours,
    quantityPerHour: preview.quantityPerHour,
    hc: preview.hc,
    tc: preview.tc,
  };
}

export function calculateMultiShiftHourSplit({ shifts = [], overtimeHours, totalExpression }) {
  const normalizedTcHours = requireNonNegativeNumber(overtimeHours, "Giờ TC");
  const { total } = parseProductionExpression(totalExpression);
  const normalizedShifts = shifts.map((shift) => ({
    slotNumber: shift.slotNumber,
    shiftName: shift.shiftName,
    workedHours: requireNonNegativeNumber(shift.workedHours, shift.shiftName || "Giờ ca"),
  }));
  const totalHours = normalizedShifts.reduce((sum, shift) => sum + shift.workedHours, 0) + normalizedTcHours;
  if (totalHours <= 0) throw new RangeError("Tổng giờ phải lớn hơn 0.");

  const buckets = [
    ...normalizedShifts
      .filter((shift) => shift.workedHours > 0)
      .map((shift) => ({ kind: "shift", slotNumber: shift.slotNumber, hours: shift.workedHours })),
    ...(normalizedTcHours > 0 ? [{ kind: "tc", slotNumber: null, hours: normalizedTcHours }] : []),
  ];
  const quantities = allocateRoundedTotal(total, buckets, totalHours);
  const quantitiesBySlot = new Map(
    buckets
      .filter((bucket) => bucket.kind === "shift")
      .map((bucket, index) => [String(bucket.slotNumber), quantities[index]]),
  );
  const tcIndex = buckets.findIndex((bucket) => bucket.kind === "tc");
  const resultShifts = normalizedShifts.map((shift) => ({
    slotNumber: shift.slotNumber,
    shiftName: shift.shiftName,
    workedHours: shift.workedHours,
    quantity: quantitiesBySlot.get(String(shift.slotNumber)) ?? 0,
  }));
  const hc = resultShifts.reduce((sum, shift) => sum + shift.quantity, 0);
  const tc = tcIndex >= 0 ? quantities[tcIndex] : 0;

  return {
    total,
    totalHours,
    quantityPerHour: total / totalHours,
    shifts: resultShifts,
    hc,
    tc,
  };
}

function allocateRoundedTotal(total, buckets, totalHours) {
  if (buckets.length === 0) return [];
  let remaining = total;
  return buckets.map((bucket, index) => {
    if (index === buckets.length - 1) return remaining;
    const rounded = roundQuantity((total * bucket.hours) / totalHours);
    const allocation = Math.min(remaining, Math.max(0, rounded));
    remaining -= allocation;
    return allocation;
  });
}

export function resolveQuickEntryQuantities({ mode, directHcQuantity, directTcQuantity, hcHours, tcHours, totalExpression }) {
  if (mode === "hour-split") {
    const preview = calculateHourSplitPreview({ hcHours, tcHours, totalExpression });
    return { hc: preview.hc, tc: preview.tc };
  }

  return {
    hc: requireNonNegativeNumber(directHcQuantity, "HC"),
    tc: requireNonNegativeNumber(directTcQuantity, "TC"),
  };
}
