export function productionOrderLookupPath(canChooseEmployee) {
  return canChooseEmployee
    ? "/api/production-orders"
    : "/api/lookups/production-orders/active";
}
