export function buildProductionExportUrl(filters = {}) {
  const params = new URLSearchParams();
  addProductionEntryFilters(params, filters);
  if (typeof filters.excludeSundays === "boolean") {
    params.set("excludeSundays", String(filters.excludeSundays));
  }
  return `${filters.basePath || "/api/reports/production/export.xlsx"}?${params.toString()}`;
}

function addProductionEntryFilters(params, filters) {
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.untilDate) params.set("untilDate", filters.untilDate);
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.orderId) params.set("orderId", filters.orderId);
  if (filters.operationId) params.set("operationId", filters.operationId);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
}
