function numberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

export function buildProductionOrderPayload(form) {
  return {
    code: form.code.trim(),
    productName: form.productName.trim(),
    plannedQuantity: Number(form.plannedQuantity),
    status: form.status,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    operations: (form.operations ?? []).map((operation, index) => ({
      operationNumber: Number(operation.operationNumber),
      name: operation.name.trim(),
      unit: operation.unit.trim(),
      fixedPrice: numberOrNull(operation.fixedPrice),
      sortOrder: Number(operation.sortOrder || index + 1),
      isActive: operation.isActive !== false,
    })),
  };
}

export function productionOrderDetailForm(order) {
  return {
    code: order.code ?? "",
    productName: order.productName ?? "",
    plannedQuantity: order.plannedQuantity ?? "",
    status: order.status ?? "Draft",
    startDate: order.startDate ?? "",
    endDate: order.endDate ?? "",
  };
}

export function resolveProductionOrderDetailDraft(order, currentDraft, preserveDraft = false) {
  return preserveDraft ? currentDraft : productionOrderDetailForm(order);
}

export function resolveProductionOrderView(pathname, detailId = "") {
  if (detailId) return "detail";
  return pathname === "/orders/new" ? "create" : "list";
}

export function shouldLoadProductionOrderList(view) {
  return view === "list";
}

export function shouldResetProductionOrderCreateDraft(previousView, nextView) {
  return nextView === "create" && previousView !== "create";
}

export function formatFixedPrice(value) {
  if (value === null || value === undefined || value === "") return "Chưa thiết lập";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 2 }).format(Number(value));
}
