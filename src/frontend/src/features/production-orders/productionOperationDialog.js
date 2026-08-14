export function emptyProductionOperation() {
  return { operationNumber: "", name: "", unit: "cái", fixedPrice: "", sortOrder: "", isActive: true };
}

export function productionOperationForm(operation = {}) {
  return {
    operationNumber: operation.operationNumber ?? "",
    name: operation.name ?? "",
    unit: operation.unit ?? "cái",
    fixedPrice: operation.fixedPrice ?? "",
    sortOrder: operation.sortOrder ?? "",
    isActive: operation.isActive !== false,
  };
}

export function productionOperationPayload(operation) {
  return {
    operationNumber: Number(operation.operationNumber),
    name: operation.name.trim(),
    unit: operation.unit.trim(),
    fixedPrice: operation.fixedPrice === "" || operation.fixedPrice === null || operation.fixedPrice === undefined ? null : Number(operation.fixedPrice),
    sortOrder: Number(operation.sortOrder || operation.operationNumber),
    isActive: operation.isActive !== false,
  };
}
