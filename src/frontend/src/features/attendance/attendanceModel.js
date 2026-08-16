export function parseAttendanceCell(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return { kind: "Empty", workedHours: null };
  if (normalized.toUpperCase() === "P") return { kind: "PaidLeave", workedHours: null };
  if (normalized.toUpperCase() === "Ô") return { kind: "SickLeave", workedHours: null };

  const numeric = Number(normalized.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Chỉ nhập số giờ không âm, P hoặc Ô.");
  }
  return { kind: "Hours", workedHours: numeric };
}

export function formatAttendanceCell(shift) {
  if (shift?.valueKind === "PaidLeave") return "P";
  if (shift?.valueKind === "SickLeave") return "Ô";
  if (shift?.valueKind === "Hours" && shift.workedHours !== null && shift.workedHours !== undefined) {
    return String(shift.workedHours);
  }
  return "";
}

export function attendanceDayKey(employeeId, workDate) {
  return `${employeeId}|${workDate}`;
}

export function mergeAttendanceEmployees(existing, incoming) {
  const byId = new Map((incoming ?? []).map((employee) => [employee.employeeId, employee]));
  const merged = (existing ?? []).map((employee) => byId.get(employee.employeeId) ?? employee);
  const existingIds = new Set((existing ?? []).map((employee) => employee.employeeId));
  return merged.concat((incoming ?? []).filter((employee) => !existingIds.has(employee.employeeId)));
}

export function buildAttendanceDrafts(data) {
  const drafts = {};
  for (const employee of data?.employees ?? []) {
    for (const day of employee.days ?? []) {
      if (!day.hasShiftSetup && !day.hasAttendance) continue;
      drafts[attendanceDayKey(employee.employeeId, day.workDate)] = {
        overtimeHours: day.overtimeHours ? String(day.overtimeHours) : "",
        shifts: Object.fromEntries((day.shifts ?? []).map((shift) => [shift.slotNumber, formatAttendanceCell(shift)])),
      };
    }
  }
  return drafts;
}

export function buildAttendanceSavePayload(data, drafts, year, month, dirtyDayKeys) {
  const days = [];
  for (const employee of data?.employees ?? []) {
    for (const day of employee.days ?? []) {
      const key = attendanceDayKey(employee.employeeId, day.workDate);
      const draft = drafts[key];
      if (!draft || !day.hasShiftSetup) continue;
      if (!dirtyDayKeys.has(key)) continue;
      const overtimeHours = draft.overtimeHours.trim() === "" ? 0 : Number(draft.overtimeHours.replace(",", "."));
      if (!Number.isFinite(overtimeHours) || overtimeHours < 0 || overtimeHours > 24) {
        throw new Error("Giờ TC phải nằm trong khoảng từ 0 đến 24.");
      }
      days.push({
        employeeId: employee.employeeId,
        workDate: day.workDate,
        overtimeHours,
        shifts: (day.shifts ?? []).map((shift) => {
          const parsed = parseAttendanceCell(draft.shifts[shift.slotNumber] ?? "");
          return { slotNumber: shift.slotNumber, kind: parsed.kind, workedHours: parsed.workedHours };
        }),
      });
    }
  }
  return { year, month, days };
}

export function shiftAttendanceMonth(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentAttendanceMonth(today = new Date()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function calculateDraftTotals(employee, drafts) {
  let regularWorkedHours = 0;
  let overtimeHours = 0;
  let paidLeaveHours = 0;
  let sickLeaveHours = 0;
  for (const day of employee.days ?? []) {
    const draft = drafts[attendanceDayKey(employee.employeeId, day.workDate)];
    if (!draft) continue;
    const overtime = Number(draft.overtimeHours.replace(",", "."));
    if (Number.isFinite(overtime)) overtimeHours += overtime;
    for (const shift of day.shifts ?? []) {
      const value = draft.shifts[shift.slotNumber] ?? "";
      try {
        const parsed = parseAttendanceCell(value);
        if (parsed.kind === "Hours") regularWorkedHours += parsed.workedHours ?? 0;
        if (parsed.kind === "PaidLeave") paidLeaveHours += shift.scheduledHours;
        if (parsed.kind === "SickLeave") sickLeaveHours += shift.scheduledHours;
      } catch {
        // Invalid drafts are reported when the user saves; totals ignore them meanwhile.
      }
    }
  }
  return { regularWorkedHours, overtimeHours, paidLeaveHours, sickLeaveHours };
}
