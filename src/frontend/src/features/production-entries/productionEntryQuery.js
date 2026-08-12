export function buildProductionEntryListQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.untilDate) params.set("untilDate", filters.untilDate);
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.orderId) params.set("orderId", filters.orderId);
  if (filters.operationId) params.set("operationId", filters.operationId);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  params.set("page", String(filters.page || 1));
  params.set("pageSize", String(filters.pageSize || 50));
  return `${filters.basePath || "/api/production-entries"}?${params.toString()}`;
}

export function normalizeProductionEntryListResponse(payload) {
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    page: Number(payload?.page) || 1,
    pageSize: Number(payload?.pageSize) || 50,
    totalCount: Number(payload?.totalCount) || 0,
    totalPages: Number(payload?.totalPages) || 0,
  };
}
