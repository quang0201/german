function numberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function bySortOrder(a, b) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.operationNumber - b.operationNumber;
}

export function emptyProduct() {
  return { code: "", name: "", isActive: true, operations: [] };
}

export function emptyTemplateOperation() {
  return { operationNumber: "", name: "", unit: "cái", fixedPrice: "", isActive: true };
}

export function productForm(product = {}) {
  return {
    code: product.code ?? "",
    name: product.name ?? "",
    isActive: product.isActive !== false,
    operations: [...(product.operations ?? [])].sort(bySortOrder).map((operation) => ({
      operationNumber: operation.operationNumber,
      name: operation.name ?? "",
      unit: operation.unit ?? "cái",
      fixedPrice: operation.fixedPrice ?? "",
      isActive: operation.isActive !== false,
    })),
  };
}

export function buildProductPayload(form) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    isActive: form.isActive !== false,
    operations: (form.operations ?? []).map((operation, index) => ({
      operationNumber: Number(operation.operationNumber),
      name: operation.name.trim(),
      unit: operation.unit.trim(),
      fixedPrice: numberOrNull(operation.fixedPrice),
      sortOrder: index + 1,
      isActive: operation.isActive !== false,
    })),
  };
}

/** Active template operations as draft rows for a new production order; the order keeps its own editable copy. */
export function operationsFromTemplate(product) {
  return [...(product?.operations ?? [])]
    .filter((operation) => operation.isActive !== false)
    .sort(bySortOrder)
    .map((operation, index) => ({
      operationNumber: operation.operationNumber,
      name: operation.name,
      unit: operation.unit,
      fixedPrice: operation.fixedPrice ?? "",
      sortOrder: index + 1,
      isActive: true,
    }));
}

const sameName = (a, b) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** Informational diff between an order's active operations and its product's active template. */
export function templateMismatch(order, product) {
  if (!product) return null;
  const template = (product.operations ?? []).filter((operation) => operation.isActive !== false);
  const own = (order?.operations ?? []).filter((operation) => operation.isActive !== false);
  const ownByNumber = new Map(own.map((operation) => [operation.operationNumber, operation]));
  const templateByNumber = new Map(template.map((operation) => [operation.operationNumber, operation]));

  const missing = template.filter((operation) => !ownByNumber.has(operation.operationNumber)).map((operation) => operation.operationNumber).sort((a, b) => a - b);
  const extra = own.filter((operation) => !templateByNumber.has(operation.operationNumber)).map((operation) => operation.operationNumber).sort((a, b) => a - b);
  const renamed = template
    .filter((operation) => ownByNumber.has(operation.operationNumber) && !sameName(ownByNumber.get(operation.operationNumber).name, operation.name))
    .map((operation) => ({ operationNumber: operation.operationNumber, orderName: ownByNumber.get(operation.operationNumber).name, templateName: operation.name }));

  return { isDifferent: missing.length + extra.length + renamed.length > 0, missing, extra, renamed };
}

/** Link a product to an order draft. Creating also copies the template operations; editing only links. */
export function applyProductToDraft(draft, product, { copyOperations }) {
  if (!product) return { ...draft, productId: "" };
  return {
    ...draft,
    productId: product.id,
    productName: draft.productName?.trim() ? draft.productName : product.name,
    operations: copyOperations ? operationsFromTemplate(product) : draft.operations,
  };
}
