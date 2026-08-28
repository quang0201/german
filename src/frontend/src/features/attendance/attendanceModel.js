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

export function activeAttendanceEmployees(employees = [], monthKey = "") {
  return employees.filter((employee) => employee.isActive !== false
    || (employee.deactivatedAt && (!monthKey || employee.deactivatedAt >= `${monthKey}-01`)));
}

export function isCurrentAttendanceRequest(requestedMonthKey, currentMonthKey, requestedGeneration, currentGeneration) {
  return requestedMonthKey === currentMonthKey && requestedGeneration === currentGeneration;
}

export function attendanceDayBlocks(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: Math.ceil(lastDay / 7) }, (_, index) => {
    const dayFrom = index * 7 + 1;
    const dayTo = Math.min(dayFrom + 6, lastDay);
    return { dayFrom, dayTo, dayCount: dayTo - dayFrom + 1 };
  });
}

export function attendanceBlockIndexForMonth(monthKey, today = new Date()) {
  if (currentAttendanceMonth(today) !== monthKey) return 0;
  return Math.floor((today.getDate() - 1) / 7);
}

export function attendanceBlockKey(generation, batchId, dayFrom) {
  return `${generation}|${batchId}|${dayFrom}`;
}

export function emptyAttendanceCache(monthKey, generation) {
  return { monthKey, generation, batches: [], employeesById: {}, blocks: {} };
}

export function mergeAttendanceCache(cache, payload, { batchId, inputCursor = null }) {
  const next = {
    ...cache,
    employeesById: { ...cache.employeesById },
    batches: [...cache.batches],
    blocks: { ...cache.blocks },
  };
  const batchIndex = next.batches.findIndex((batch) => batch.id === batchId);
  const existingBatch = batchIndex >= 0 ? next.batches[batchIndex] : null;
  const employeeIds = [];
  for (const employee of payload?.employees ?? []) {
    employeeIds.push(employee.employeeId);
    next.employeesById[employee.employeeId] = {
      employeeId: employee.employeeId,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      isActive: employee.isActive !== false,
      deactivatedAt: employee.deactivatedAt ?? null,
      totals: employee.totals ?? { regularWorkedHours: 0, overtimeHours: 0, paidLeaveHours: 0, sickLeaveHours: 0 },
    };
  }
  const batch = {
    ...(existingBatch ?? {}),
    id: batchId,
    inputCursor,
    nextCursor: payload?.nextEmployeeCursor ?? existingBatch?.nextCursor ?? null,
    employeeIds: existingBatch?.employeeIds?.length ? existingBatch.employeeIds : employeeIds,
  };
  if (batchIndex >= 0) next.batches[batchIndex] = batch;
  else next.batches.push(batch);
  const blockKey = attendanceBlockKey(next.generation, batchId, payload.dayFrom);
  next.blocks[blockKey] = {
    key: blockKey,
    batchId,
    dayFrom: payload.dayFrom,
    dayTo: payload.dayTo,
    status: "loaded",
    error: "",
    daysByEmployee: Object.fromEntries((payload.employees ?? []).map((employee) => [employee.employeeId, employee.days ?? []])),
  };
  return next;
}

export function setAttendanceBlockStatus(cache, blockKey, status, error = "", metadata = {}) {
  const block = cache.blocks[blockKey] ?? {
    key: blockKey,
    batchId: metadata.batchId,
    dayFrom: metadata.dayFrom,
    status: "idle",
    error: "",
    daysByEmployee: {},
  };
  return {
    ...cache,
    blocks: {
      ...cache.blocks,
      [blockKey]: {
        ...block,
        batchId: block.batchId ?? metadata.batchId,
        dayFrom: block.dayFrom ?? metadata.dayFrom,
        status,
        error,
      },
    },
  };
}

function dateForDay(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function placeholderDays(year, month, dayFrom, dayTo) {
  return Array.from({ length: dayTo - dayFrom + 1 }, (_, index) => ({
    workDate: dateForDay(year, month, dayFrom + index),
    hasAttendance: false,
    hasShiftSetup: false,
    overtimeHours: 0,
    shifts: [],
  }));
}

export function buildAttendanceRenderData(cache, monthKey, renderedBlockStarts) {
  const [year, month] = monthKey.split("-").map(Number);
  const selectedBlocks = attendanceDayBlocks(year, month).filter((block) => renderedBlockStarts.includes(block.dayFrom));
  const employees = cache.batches.flatMap((batch) => batch.employeeIds.map((employeeId) => {
    const identity = cache.employeesById[employeeId];
    const allDays = [];
    const renderedDays = [];
    for (const block of attendanceDayBlocks(year, month)) {
      const cached = cache.blocks[attendanceBlockKey(cache.generation, batch.id, block.dayFrom)];
      allDays.push(...(cached?.daysByEmployee?.[employeeId] ?? []));
    }
    for (const block of selectedBlocks) {
      const cached = cache.blocks[attendanceBlockKey(cache.generation, batch.id, block.dayFrom)];
      renderedDays.push(...(cached?.daysByEmployee?.[employeeId] ?? placeholderDays(year, month, block.dayFrom, block.dayTo)));
    }
    return { ...identity, days: renderedDays, loadedDays: allDays };
  }));
  const lastBatch = cache.batches.at(-1);
  const lastBlock = selectedBlocks.at(-1);
  return {
    year,
    month,
    employees,
    dayFrom: selectedBlocks[0]?.dayFrom ?? 1,
    dayTo: lastBlock?.dayTo ?? 10,
    hasMoreEmployees: Boolean(lastBatch?.nextCursor),
    nextEmployeeCursor: lastBatch?.nextCursor ?? null,
    blockStatus: Object.fromEntries(selectedBlocks.flatMap((block) => cache.batches.map((batch) => {
      const key = attendanceBlockKey(cache.generation, batch.id, block.dayFrom);
      return [key, cache.blocks[key]?.status ?? "idle"];
    }))),
    blockErrors: Object.fromEntries(selectedBlocks.flatMap((block) => cache.batches.map((batch) => {
      const key = attendanceBlockKey(cache.generation, batch.id, block.dayFrom);
      return [key, cache.blocks[key]?.error ?? ""];
    }))),
  };
}

export function buildAttendanceSaveData(cache) {
  const daysByEmployee = {};
  for (const block of Object.values(cache.blocks)) {
    for (const [employeeId, days] of Object.entries(block.daysByEmployee ?? {})) {
      daysByEmployee[employeeId] = [...(daysByEmployee[employeeId] ?? []), ...days];
    }
  }
  return {
    employees: cache.batches.flatMap((batch) => batch.employeeIds.map((employeeId) => ({
      ...cache.employeesById[employeeId],
      days: daysByEmployee[employeeId] ?? [],
    }))),
  };
}

export function mergeDraftsPreservingDirty(drafts, payload, dirtyDayKeys) {
  const next = { ...drafts };
  for (const employee of payload?.employees ?? []) {
    for (const day of employee.days ?? []) {
      const key = attendanceDayKey(employee.employeeId, day.workDate);
      if (!dirtyDayKeys.has(key)) {
        next[key] = {
          overtimeHours: day.overtimeHours ? String(day.overtimeHours) : "",
          shifts: Object.fromEntries((day.shifts ?? []).map((shift) => [shift.slotNumber, formatAttendanceCell(shift)])),
        };
      }
    }
  }
  return next;
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

export function mergeAttendanceSaveDrafts(drafts, result, submittedRevisions, currentRevisions) {
  const serverDrafts = buildAttendanceDrafts(result);
  const next = { ...drafts };
  const acknowledgedKeys = [];
  for (const employee of result?.employees ?? []) {
    for (const day of employee.days ?? []) {
      const key = attendanceDayKey(employee.employeeId, day.workDate);
      if (submittedRevisions[key] === undefined || currentRevisions[key] !== submittedRevisions[key]) continue;
      next[key] = serverDrafts[key];
      acknowledgedKeys.push(key);
    }
  }
  return { drafts: next, acknowledgedKeys };
}

export function buildAttendanceSavePayload(data, drafts, year, month, dirtyDayKeys) {
  const days = [];
  for (const employee of data?.employees ?? []) {
    for (const day of employee.loadedDays ?? employee.days ?? []) {
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

export function patchAttendanceSave(cache, result) {
  const next = { ...cache, employeesById: { ...cache.employeesById }, blocks: { ...cache.blocks } };
  for (const employee of result?.employees ?? []) {
    if (next.employeesById[employee.employeeId]) {
      next.employeesById[employee.employeeId] = { ...next.employeesById[employee.employeeId], totals: employee.totals };
    }
    for (const day of employee.days ?? []) {
      for (const [key, block] of Object.entries(next.blocks)) {
        if (!block.daysByEmployee?.[employee.employeeId]) continue;
        const existing = block.daysByEmployee[employee.employeeId];
        if (!existing.some((item) => item.workDate === day.workDate)) continue;
        next.blocks[key] = {
          ...block,
          daysByEmployee: {
            ...block.daysByEmployee,
            [employee.employeeId]: existing.map((item) => item.workDate === day.workDate ? day : item),
          },
        };
      }
    }
  }
  return next;
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

function dayTotals(day, draft) {
  let regularWorkedHours = 0;
  let paidLeaveHours = 0;
  let sickLeaveHours = 0;
  const overtimeHours = draft ? Number(String(draft.overtimeHours ?? "").replace(",", ".")) || 0 : day.overtimeHours ?? 0;
  for (const shift of day.shifts ?? []) {
    const value = draft ? draft.shifts?.[shift.slotNumber] ?? "" : formatAttendanceCell(shift);
    try {
      const parsed = parseAttendanceCell(value);
      if (parsed.kind === "Hours") regularWorkedHours += parsed.workedHours ?? 0;
      if (parsed.kind === "PaidLeave") paidLeaveHours += shift.scheduledHours;
      if (parsed.kind === "SickLeave") sickLeaveHours += shift.scheduledHours;
    } catch {
      // Invalid drafts are reported on save and excluded from the live delta.
    }
  }
  return { regularWorkedHours, overtimeHours, paidLeaveHours, sickLeaveHours };
}

export function calculateDisplayTotals(employee, drafts) {
  const persisted = employee.totals ?? { regularWorkedHours: 0, overtimeHours: 0, paidLeaveHours: 0, sickLeaveHours: 0 };
  const delta = { regularWorkedHours: 0, overtimeHours: 0, paidLeaveHours: 0, sickLeaveHours: 0 };
  for (const day of employee.loadedDays ?? employee.days ?? []) {
    const key = attendanceDayKey(employee.employeeId, day.workDate);
    const draft = drafts[key];
    if (!draft) continue;
    const current = dayTotals(day, draft);
    const persistedDay = dayTotals(day);
    for (const field of Object.keys(delta)) delta[field] += current[field] - persistedDay[field];
  }
  return Object.fromEntries(Object.keys(delta).map((field) => [field, persisted[field] + delta[field]]));
}
