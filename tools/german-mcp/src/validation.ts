export interface ExternalQuantityInput {
  orderCode: string;
  operationNumber: number;
  receivedDate: string;
  quantity: number;
  sourceId?: string;
  sourceName?: string;
  confirm: boolean;
}

export interface ProductionBatchItemInput {
  operationNumber: number;
  directHcQuantity?: number;
  directTcQuantity?: number;
  totalQuantity?: number;
  note?: string;
}

export interface ProductionBatchInput {
  workDate: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  orderCode: string;
  items: ProductionBatchItemInput[];
  confirm: boolean;
}

export interface ProductionEntryUpdateInput extends ProductionBatchInput {
  entryId: string;
  version: number;
}

export interface ProductionEntryDeleteInput {
  entryId: string;
  version: number;
  confirm: boolean;
}

function validateIsoDate(value: unknown, field: string): string {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${field} must use YYYY-MM-DD.`);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error(`${field} is invalid.`);
  return date;
}

function optionalQuantity(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative number.`);
  return value;
}

export function validateProductionBatchInput(input: unknown, options: { requireConfirmation?: boolean } = {}): ProductionBatchInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object.");
  const value = input as Partial<ProductionBatchInput>;
  const workDate = validateIsoDate(value.workDate, "workDate");
  const orderCode = String(value.orderCode ?? "").trim();
  if (!orderCode || orderCode.length > 100) throw new Error("orderCode is required and must be at most 100 characters.");

  const selectors = [value.employeeId, value.employeeCode, value.employeeName]
    .filter((item) => item !== undefined && String(item).trim().length > 0);
  if (selectors.length !== 1) throw new Error("Provide only one employee selector: employeeId, employeeCode, or employeeName.");

  if (!Array.isArray(value.items) || value.items.length === 0) throw new Error("items must contain at least one operation.");
  if (value.items.length > 100) throw new Error("items cannot contain more than 100 operations.");
  const seenOperations = new Set<number>();
  const items = value.items.map((rawItem) => {
    if (!rawItem || typeof rawItem !== "object") throw new Error("Each production item must be an object.");
    const item = rawItem as ProductionBatchItemInput;
    if (!Number.isInteger(item.operationNumber) || item.operationNumber < 1) throw new Error("operationNumber must be a positive integer.");
    if (seenOperations.has(item.operationNumber)) throw new Error("operationNumber values must be unique.");
    seenOperations.add(item.operationNumber);

    const directHcQuantity = optionalQuantity(item.directHcQuantity, "directHcQuantity");
    const directTcQuantity = optionalQuantity(item.directTcQuantity, "directTcQuantity");
    const totalQuantity = optionalQuantity(item.totalQuantity, "totalQuantity");
    const hasDirect = directHcQuantity !== undefined || directTcQuantity !== undefined;
    if (hasDirect && totalQuantity !== undefined) throw new Error("Use either totalQuantity or direct HC/TC quantities, not both.");
    if (!hasDirect && totalQuantity === undefined) throw new Error("Each item needs totalQuantity or a direct HC/TC quantity.");
    if (hasDirect && (directHcQuantity ?? 0) + (directTcQuantity ?? 0) <= 0) throw new Error("Each production item must be greater than zero.");
    if (totalQuantity !== undefined && totalQuantity <= 0) throw new Error("totalQuantity must be greater than zero.");
    const note = item.note === undefined || item.note === null ? undefined : String(item.note).trim();
    if (note && note.length > 500) throw new Error("note must be at most 500 characters.");
    return {
      operationNumber: item.operationNumber,
      ...(directHcQuantity !== undefined ? { directHcQuantity } : {}),
      ...(directTcQuantity !== undefined ? { directTcQuantity } : {}),
      ...(totalQuantity !== undefined ? { totalQuantity } : {}),
      ...(note ? { note } : {}),
    };
  });

  if (options.requireConfirmation !== false && value.confirm !== true) throw new Error("confirm must be true before a write operation.");
  return {
    workDate,
    ...(value.employeeId !== undefined && String(value.employeeId).trim() ? { employeeId: String(value.employeeId).trim() } : {}),
    ...(value.employeeCode !== undefined && String(value.employeeCode).trim() ? { employeeCode: String(value.employeeCode).trim() } : {}),
    ...(value.employeeName !== undefined && String(value.employeeName).trim() ? { employeeName: String(value.employeeName).trim() } : {}),
    orderCode,
    items,
    confirm: value.confirm === true,
  };
}

export function validateProductionEntryUpdateInput(input: unknown, options: { requireConfirmation?: boolean } = {}): ProductionEntryUpdateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object.");
  const value = input as Record<string, unknown>;
  const entryId = String(value.entryId ?? "").trim();
  if (!entryId) throw new Error("entryId is required.");
  if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error("version must be a positive integer.");
  const batch = validateProductionBatchInput({
    ...value,
    items: [{
      operationNumber: value.operationNumber,
      directHcQuantity: value.directHcQuantity,
      directTcQuantity: value.directTcQuantity,
      totalQuantity: value.totalQuantity,
      note: value.note,
    }],
  }, options);
  return { ...batch, entryId, version: Number(value.version) };
}

export function validateProductionEntryDeleteInput(input: unknown): ProductionEntryDeleteInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object.");
  const value = input as Partial<ProductionEntryDeleteInput>;
  const entryId = String(value.entryId ?? "").trim();
  if (!entryId) throw new Error("entryId is required.");
  if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error("version must be a positive integer.");
  if (value.confirm !== true) throw new Error("confirm must be true before a write operation.");
  return { entryId, version: Number(value.version), confirm: true };
}

export function validateExternalQuantityInput(input: unknown, options: { requireConfirmation?: boolean } = {}): ExternalQuantityInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object.");
  const value = input as Partial<ExternalQuantityInput>;
  const orderCode = String(value.orderCode ?? "").trim();
  const sourceId = String(value.sourceId ?? "").trim();
  const sourceName = String(value.sourceName ?? "").trim();

  if (!orderCode || orderCode.length > 100) throw new Error("orderCode is required and must be at most 100 characters.");
  if (!Number.isInteger(value.operationNumber) || Number(value.operationNumber) < 1) throw new Error("operationNumber must be a positive integer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value.receivedDate ?? ""))) throw new Error("receivedDate must use YYYY-MM-DD.");
  const parsedDate = new Date(`${value.receivedDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== value.receivedDate) throw new Error("receivedDate is invalid.");
  if (typeof value.quantity !== "number" || !Number.isFinite(value.quantity) || value.quantity <= 0) throw new Error("quantity must be greater than zero.");
  if (sourceId && sourceName) throw new Error("Provide only one of sourceId or sourceName.");
  if (!sourceId && !sourceName) throw new Error("sourceId or sourceName is required.");
  if (sourceName.length > 200) throw new Error("sourceName must be at most 200 characters.");
  if (options.requireConfirmation !== false && value.confirm !== true) throw new Error("confirm must be true before a write operation.");

  return {
    orderCode,
    operationNumber: Number(value.operationNumber),
    receivedDate: String(value.receivedDate),
    quantity: value.quantity,
    ...(sourceId ? { sourceId } : { sourceName }),
    confirm: value.confirm === true,
  };
}
