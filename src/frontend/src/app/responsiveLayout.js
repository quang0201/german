export function getShellMode(width) {
  if (width >= 1280) return "wide";
  if (width >= 1024) return "compact";
  if (width >= 640) return "tablet";
  return "mobile";
}

const managerMobileColumns = ["workDate", "employeeCode", "productionOrderCode", "operationNumber", "totalQuantity", "actions"];
const workerMobileColumns = ["workDate", "productionOrderCode", "operationNumber", "totalQuantity", "actions"];
const completeColumns = ["workDate", "employeeCode", "employeeName", "productionOrderCode", "operationNumber", "hcQuantity", "tcQuantity", "totalQuantity", "entryMode", "actions"];

export function getProductionEntryColumnKeys(role, mode) {
  return mode === "mobile"
    ? (role === "Worker" ? workerMobileColumns : managerMobileColumns)
    : completeColumns;
}
