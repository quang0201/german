import { GermanApiClient } from "./germanApiClient.ts";
import { validateExternalQuantityInput, type ExternalQuantityInput } from "./validation.ts";

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLocaleUpperCase("vi-VN");
}

async function findOrder(client: GermanApiClient, orderCode: string) {
  const orders = await client.get<Array<Record<string, any>>>("/api/production-orders");
  const matches = orders.filter((order) => normalize(order.code) === normalize(orderCode));
  if (matches.length === 0) throw new Error(`Không tìm thấy mã sản xuất: ${orderCode}.`);
  if (matches.length > 1) throw new Error(`Mã sản xuất không duy nhất: ${orderCode}.`);
  return matches[0];
}

async function findOperation(order: Record<string, any>, operationNumber: number) {
  const operation = (order.operations || []).find((item: Record<string, any>) => Number(item.operationNumber) === operationNumber);
  if (!operation) throw new Error(`Không tìm thấy CĐ${operationNumber} trong mã ${order.code}.`);
  return operation;
}

async function findSource(client: GermanApiClient, input: ExternalQuantityInput) {
  const sources = await client.get<Array<Record<string, any>>>("/api/production-external-sources?includeInactive=true");
  const source = input.sourceId
    ? sources.find((item) => String(item.id) === input.sourceId)
    : sources.find((item) => normalize(item.name) === normalize(input.sourceName));
  if (!source) throw new Error(`Không tìm thấy nguồn gia công ngoài: ${input.sourceId || input.sourceName}.`);
  if (source.isActive === false) throw new Error(`Nguồn gia công ngoài đã tắt: ${source.name}.`);
  return source;
}

export async function findProductionOrders(client: GermanApiClient, query = "") {
  const orders = await client.get<Array<Record<string, any>>>("/api/production-orders");
  const text = normalize(query);
  return text
    ? orders.filter((order) => normalize(order.code).includes(text) || normalize(order.productName).includes(text))
    : orders;
}

export async function listExternalSources(client: GermanApiClient, includeInactive = false) {
  return client.get(`/api/production-external-sources${includeInactive ? "?includeInactive=true" : ""}`);
}

export async function listExternalQuantities(client: GermanApiClient, orderCode: string, fromDate?: string, untilDate?: string) {
  const order = await findOrder(client, orderCode);
  const params = new URLSearchParams({ orderId: String(order.id) });
  if (fromDate) params.set("fromDate", fromDate);
  if (untilDate) params.set("untilDate", untilDate);
  return client.get(`/api/production-external-quantities?${params}`);
}

export async function previewExternalQuantity(client: GermanApiClient, rawInput: unknown) {
  const input = validateExternalQuantityInput({ ...(rawInput as Record<string, unknown>), confirm: true }, { requireConfirmation: false });
  const order = await findOrder(client, input.orderCode);
  const operation = await findOperation(order, input.operationNumber);
  const source = await findSource(client, input);
  return {
    writeRequired: true,
    confirmed: false,
    order: { id: order.id, code: order.code, productName: order.productName },
    operation: { id: operation.id, operationNumber: operation.operationNumber, name: operation.name, unit: operation.unit },
    source: { id: source.id, name: source.name },
    receivedDate: input.receivedDate,
    quantity: input.quantity,
  };
}

export async function createExternalQuantity(client: GermanApiClient, rawInput: unknown) {
  const input = validateExternalQuantityInput(rawInput);
  const preview = await previewExternalQuantity(client, input);
  return client.post("/api/production-external-quantities", {
    productionOrderId: preview.order.id,
    productionOperationId: preview.operation.id,
    receivedDate: preview.receivedDate,
    quantity: preview.quantity,
    externalSourceId: preview.source.id,
    sourceName: null,
    note: null,
  });
}
