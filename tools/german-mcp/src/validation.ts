export interface ExternalQuantityInput {
  orderCode: string;
  operationNumber: number;
  receivedDate: string;
  quantity: number;
  sourceId?: string;
  sourceName?: string;
  confirm: boolean;
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
