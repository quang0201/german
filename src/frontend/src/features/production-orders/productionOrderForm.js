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

export function formatFixedPrice(value) {
  if (value === null || value === undefined || value === "") return "Chưa thiết lập";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 2 }).format(Number(value));
}
