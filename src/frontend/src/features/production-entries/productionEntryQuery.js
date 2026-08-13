export function buildProductionEntryListQuery(filters = {}) {
  const params = new URLSearchParams();
  addProductionEntryFilters(params, filters);
  params.set("page", String(filters.page || 1));
  params.set("pageSize", String(filters.pageSize || 50));
  return `${filters.basePath || "/api/production-entries"}?${params.toString()}`;
}

export function buildProductionExportUrl(filters = {}) {
  const params = new URLSearchParams();
  addProductionEntryFilters(params, filters);
  if (typeof filters.excludeSundays === "boolean") {
    params.set("excludeSundays", String(filters.excludeSundays));
  }
  return `${filters.basePath || "/api/reports/production/export.xlsx"}?${params.toString()}`;
}

export function normalizeProductionEntryListResponse(payload) {
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    page: Number(payload?.page) || 1,
    pageSize: Number(payload?.pageSize) || 50,
    totalCount: Number(payload?.totalCount) || 0,
    totalPages: Number(payload?.totalPages) || 0,
    summary: normalizeSummary(payload?.summary),
  };
}

function addProductionEntryFilters(params, filters) {
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.untilDate) params.set("untilDate", filters.untilDate);
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.orderId) params.set("orderId", filters.orderId);
  if (filters.operationId) params.set("operationId", filters.operationId);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
}

function normalizeSummary(summary) {
  return {
    employeeCount: numberOrZero(summary?.employeeCount),
    entryCount: numberOrZero(summary?.entryCount),
    hcQuantity: numberOrZero(summary?.hcQuantity),
    tcQuantity: numberOrZero(summary?.tcQuantity),
    totalQuantity: numberOrZero(summary?.totalQuantity),
  };
}

function numberOrZero(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
