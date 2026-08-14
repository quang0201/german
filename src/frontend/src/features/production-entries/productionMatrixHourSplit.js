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
  const { total } = parseProductionExpression(totalExpression);
  const totalHours = normalizedHcHours + normalizedTcHours;
  if (totalHours <= 0) throw new RangeError("Tổng giờ phải lớn hơn 0.");

  const hc = roundQuantity((total * normalizedHcHours) / totalHours);
  return {
    total,
    totalHours,
    quantityPerHour: total / totalHours,
    hc,
    tc: total - hc,
  };
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
