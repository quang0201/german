function valueOrZero(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError("Sản lượng và thời gian không được âm.");
  }
  return parsed;
}

function roundQuantity(value) {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

function requireHcHours(hcHours) {
  const hours = valueOrZero(hcHours);
  if (hours <= 0) {
    throw new RangeError("Cần bộ ca HC hợp lệ để tự tính tăng ca.");
  }
  return hours;
}

export function calculatePreview(input) {
  const mode = input.mode;

  if (mode === "ByShift") {
    const hc = valueOrZero(input.shift1Quantity) + valueOrZero(input.shift2Quantity);
    let tc = 0;

    if (input.overtimeQuantity !== null && input.overtimeQuantity !== undefined && input.overtimeQuantity !== "") {
      tc = valueOrZero(input.overtimeQuantity);
    } else {
      const overtimeHours = valueOrZero(input.overtimeHours);
      if (overtimeHours > 0) {
        const hcHours = requireHcHours(input.hcHours);
        tc = roundQuantity((hc / hcHours) * overtimeHours);
      }
    }

    return { hc, tc, total: hc + tc };
  }

  if (mode === "Direct") {
    const hc = valueOrZero(input.directHcQuantity);
    const tc = valueOrZero(input.directTcQuantity);
    return { hc, tc, total: hc + tc };
  }

  if (mode === "TotalWithOvertime") {
    const total = valueOrZero(input.totalQuantity);
    const overtimeHours = valueOrZero(input.overtimeHours);
    if (overtimeHours <= 0) {
      return { hc: total, tc: 0, total };
    }

    const hcHours = requireHcHours(input.hcHours);
    const hc = roundQuantity((total * hcHours) / (hcHours + overtimeHours));
    return { hc, tc: total - hc, total };
  }

  throw new RangeError("Kiểu nhập sản lượng không hợp lệ.");
}
