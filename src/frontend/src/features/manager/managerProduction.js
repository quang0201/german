export function buildProductionEntryQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.orderId) params.set("orderId", filters.orderId);
  if (filters.operationId) params.set("operationId", filters.operationId);
  const query = params.toString();
  return `/api/production-entries${query ? `?${query}` : ""}`;
}

export function buildDirectUpdatePayload(entry, hc, tc, note) {
  return {
    version: entry.version,
    workDate: entry.workDate,
    employeeId: entry.employeeId,
    productionOrderId: entry.productionOrderId,
    productionOperationId: entry.productionOperationId,
    entryMode: "Direct",
    shift1Quantity: null,
    shift2Quantity: null,
    directHcQuantity: Number(hc),
    directTcQuantity: Number(tc),
    totalInputQuantity: null,
    overtimeHours: null,
    overtimeQuantity: null,
    workStart: entry.workStart ?? null,
    workEnd: entry.workEnd ?? null,
    note: note?.trim() || null,
  };
}
