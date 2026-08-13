export function buildProductionExportUrl(filters = {}) {
  const params = new URLSearchParams();
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.untilDate) params.set("untilDate", filters.untilDate);
  if (typeof filters.excludeSundays === "boolean") params.set("excludeSundays", String(filters.excludeSundays));
  return `${filters.basePath || "/api/reports/production/export.xlsx"}?${params.toString()}`;
}
