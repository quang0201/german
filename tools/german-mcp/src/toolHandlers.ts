import { GermanApiClient } from "./germanApiClient.ts";
import {
  validateExternalQuantityInput,
  validateProductionBatchInput,
  validateProductionEntryDeleteInput,
  validateProductionEntryUpdateInput,
  type ExternalQuantityInput,
  type ProductionBatchInput,
} from "./validation.ts";

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

async function findEmployee(client: GermanApiClient, input: ProductionBatchInput) {
  const employees = await client.get<Array<Record<string, any>>>("/api/employees/");
  const matches = input.employeeId
    ? employees.filter((employee) => String(employee.id) === input.employeeId)
    : employees.filter((employee) => {
      const selector = input.employeeCode || input.employeeName;
      const field = input.employeeCode ? employee.employeeCode : employee.fullName;
      return normalize(field) === normalize(selector);
    });
  if (matches.length === 0) throw new Error(`Không tìm thấy nhân viên: ${input.employeeId || input.employeeCode || input.employeeName}.`);
  if (matches.length > 1) throw new Error(`Nhân viên không duy nhất: ${input.employeeCode || input.employeeName}.`);
  if (matches[0].isActive === false) throw new Error(`Nhân viên đã ngừng hoạt động: ${matches[0].fullName}.`);
  return matches[0];
}

async function getAttendance(client: GermanApiClient, employeeId: string, workDate: string) {
  return client.get<Record<string, any>>(`/api/lookups/attendance-hours?employeeId=${encodeURIComponent(employeeId)}&date=${encodeURIComponent(workDate)}`);
}

function roundQuantity(value: number): number {
  return Number(value.toFixed(6));
}

function attendanceRequest(attendance: Record<string, any>, employeeId: string, workDate: string) {
  if (!attendance.hasAttendance) return null;
  return {
    employeeId,
    workDate,
    overtimeHours: Number(attendance.overtimeHours || 0),
    shifts: (attendance.shifts || []).map((shift: Record<string, any>) => {
      const kind = shift.valueKind || shift.kind || "Empty";
      return {
        slotNumber: Number(shift.slotNumber),
        kind,
        workedHours: kind === "Hours" ? Number(shift.workedHours || 0) : null,
      };
    }),
  };
}

function quantitiesForItem(item: ProductionBatchInput["items"][number], attendance: Record<string, any>) {
  if (item.totalQuantity === undefined) {
    return {
      directHcQuantity: item.directHcQuantity ?? 0,
      directTcQuantity: item.directTcQuantity ?? 0,
    };
  }

  const regularHours = Number(attendance.regularHours || 0);
  const overtimeHours = Number(attendance.overtimeHours || 0);
  const totalHours = regularHours + overtimeHours;
  if (!attendance.hasAttendance || totalHours <= 0) {
    throw new Error(`Không thể chia ${item.totalQuantity} theo giờ vì ngày đó chưa có giờ chấm công.`);
  }
  const hc = roundQuantity(item.totalQuantity * regularHours / totalHours);
  return { directHcQuantity: hc, directTcQuantity: roundQuantity(item.totalQuantity - hc) };
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

export async function findEmployees(client: GermanApiClient, query = "") {
  const employees = await client.get<Array<Record<string, any>>>("/api/employees/");
  const text = normalize(query);
  return text
    ? employees.filter((employee) => normalize(employee.employeeCode).includes(text) || normalize(employee.fullName).includes(text))
    : employees;
}

export async function getAttendanceHours(client: GermanApiClient, employeeId: string, workDate: string) {
  return getAttendance(client, employeeId, workDate);
}

export async function listProductionEntries(client: GermanApiClient, input: {
  date?: string;
  fromDate?: string;
  untilDate?: string;
  employeeId?: string;
  orderCode?: string;
  operationNumber?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (input.date) params.set("date", input.date);
  if (input.fromDate) params.set("fromDate", input.fromDate);
  if (input.untilDate) params.set("untilDate", input.untilDate);
  if (input.employeeId) params.set("employeeId", input.employeeId);
  if (input.search) params.set("search", input.search);
  if (input.page !== undefined) params.set("page", String(input.page));
  if (input.pageSize !== undefined) params.set("pageSize", String(input.pageSize));
  if (input.orderCode) {
    const order = await findOrder(client, input.orderCode);
    params.set("orderId", String(order.id));
    if (input.operationNumber !== undefined) {
      const operation = await findOperation(order, input.operationNumber);
      params.set("operationId", String(operation.id));
    }
  }
  return client.get(`/api/production-entries/?${params}`);
}

export async function previewProductionBatch(client: GermanApiClient, rawInput: unknown) {
  const input = validateProductionBatchInput(rawInput, { requireConfirmation: false });
  const [employee, order] = await Promise.all([findEmployee(client, input), findOrder(client, input.orderCode)]);
  const attendance = await getAttendance(client, String(employee.id), input.workDate);
  const operations = await Promise.all(input.items.map((item) => findOperation(order, item.operationNumber)));
  const attendancePayload = attendanceRequest(attendance, String(employee.id), input.workDate);
  const items = input.items.map((item, index) => {
    const quantities = quantitiesForItem(item, attendance);
    return {
      operationNumber: operations[index].operationNumber,
      operation: { id: operations[index].id, name: operations[index].name, unit: operations[index].unit },
      directHcQuantity: quantities.directHcQuantity,
      directTcQuantity: quantities.directTcQuantity,
      totalQuantity: roundQuantity(quantities.directHcQuantity + quantities.directTcQuantity),
      note: item.note || null,
    };
  });
  const request = {
    workDate: input.workDate,
    employeeId: employee.id,
    productionOrderId: order.id,
    items: items.map((item) => ({
      productionOperationId: item.operation.id,
      directHcQuantity: item.directHcQuantity,
      directTcQuantity: item.directTcQuantity,
      note: item.note,
    })),
    ...(attendancePayload ? { attendance: attendancePayload } : {}),
  };
  return {
    writeRequired: true,
    confirmed: false,
    employee: { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName },
    order: { id: order.id, code: order.code, productName: order.productName },
    attendance: {
      hasAttendance: Boolean(attendance.hasAttendance),
      regularHours: Number(attendance.regularHours || 0),
      overtimeHours: Number(attendance.overtimeHours || 0),
    },
    items,
    request,
  };
}

export async function createProductionBatch(client: GermanApiClient, rawInput: unknown) {
  const input = validateProductionBatchInput(rawInput);
  const preview = await previewProductionBatch(client, { ...input, confirm: false });
  return client.post("/api/production-entries/batch-direct", preview.request);
}

export async function previewProductionEntryUpdate(client: GermanApiClient, rawInput: unknown) {
  const input = validateProductionEntryUpdateInput(rawInput, { requireConfirmation: false });
  const preview = await previewProductionBatch(client, { ...input, confirm: false });
  const item = preview.items[0];
  return {
    writeRequired: true,
    confirmed: false,
    entryId: input.entryId,
    version: input.version,
    employee: preview.employee,
    order: preview.order,
    attendance: preview.attendance,
    item,
    request: {
      version: input.version,
      workDate: input.workDate,
      employeeId: preview.employee.id,
      productionOrderId: preview.order.id,
      productionOperationId: item.operation.id,
      entryMode: "Direct",
      shift1Quantity: null,
      shift2Quantity: null,
      directHcQuantity: item.directHcQuantity,
      directTcQuantity: item.directTcQuantity,
      totalInputQuantity: null,
      overtimeHours: null,
      overtimeQuantity: null,
      workStart: null,
      workEnd: null,
      note: item.note,
      hcHours: null,
    },
  };
}

export async function updateProductionEntry(client: GermanApiClient, rawInput: unknown) {
  const input = validateProductionEntryUpdateInput(rawInput);
  const sourceItem = input.items[0];
  const preview = await previewProductionEntryUpdate(client, {
    ...input,
    operationNumber: sourceItem.operationNumber,
    directHcQuantity: sourceItem.directHcQuantity,
    directTcQuantity: sourceItem.directTcQuantity,
    totalQuantity: sourceItem.totalQuantity,
    note: sourceItem.note,
    confirm: false,
  });
  return client.put(`/api/production-entries/${encodeURIComponent(input.entryId)}`, preview.request);
}

export async function deleteProductionEntry(client: GermanApiClient, rawInput: unknown) {
  const input = validateProductionEntryDeleteInput(rawInput);
  return client.delete(`/api/production-entries/${encodeURIComponent(input.entryId)}?version=${input.version}`);
}
