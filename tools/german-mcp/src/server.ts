import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AuditLogger } from "./auditLogger.ts";
import { loadConfig } from "./config.ts";
import { GermanApiClient } from "./germanApiClient.ts";
import {
  createExternalQuantity,
  createProductionBatch,
  findEmployees,
  findProductionOrders,
  getAttendanceHours,
  listExternalQuantities,
  listExternalSources,
  listProductionEntries,
  previewExternalQuantity,
  previewProductionBatch,
  previewProductionEntryUpdate,
  updateProductionEntry,
  deleteProductionEntry,
} from "./toolHandlers.ts";

const config = loadConfig();
const client = new GermanApiClient(config.api);
const logger = new AuditLogger(config.logDirectory);
const server = new McpServer({ name: "german-hr", version: "0.1.0" });

function json(value: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

async function runTool<T>(tool: string, input: unknown, action: () => Promise<T>) {
  const started = Date.now();
  try {
    const result = await action();
    await logger.record({ tool, ok: true, durationMs: Date.now() - started, input });
    return json(result);
  } catch (error) {
    const typed = error as Error & { code?: string; status?: number };
    await logger.record({ tool, ok: false, durationMs: Date.now() - started, input, error: { code: typed.code, status: typed.status, message: typed.message } });
    return { isError: true, ...json({ error: typed.message }) };
  }
}

server.registerTool("german_find_production_orders", {
  description: "Tìm mã sản xuất theo mã hoặc tên sản phẩm.",
  inputSchema: { query: z.string().max(200).optional() },
}, async ({ query }) => runTool("german_find_production_orders", { query }, () => findProductionOrders(client, query)));

server.registerTool("german_find_employees", {
  description: "Tìm nhân viên theo mã hoặc họ tên để dùng cho thao tác sản lượng.",
  inputSchema: { query: z.string().max(200).optional() },
}, async ({ query }) => runTool("german_find_employees", { query }, () => findEmployees(client, query)));

server.registerTool("german_get_attendance_hours", {
  description: "Lấy giờ hành chính, giờ tăng ca và các ca chấm công của một nhân viên trong ngày.",
  inputSchema: { employeeId: z.string().uuid(), workDate: z.string() },
}, async ({ employeeId, workDate }) => runTool("german_get_attendance_hours", { employeeId, workDate }, () => getAttendanceHours(client, employeeId, workDate)));

server.registerTool("german_list_external_sources", {
  description: "Liệt kê nguồn gia công ngoài đang dùng hoặc toàn bộ nguồn.",
  inputSchema: { includeInactive: z.boolean().optional() },
}, async ({ includeInactive }) => runTool("german_list_external_sources", { includeInactive }, () => listExternalSources(client, includeInactive)));

server.registerTool("german_list_external_quantities", {
  description: "Kiểm tra các bản ghi gia công ngoài theo mã sản xuất và khoảng ngày.",
  inputSchema: { orderCode: z.string().min(1).max(100), fromDate: z.string().optional(), untilDate: z.string().optional() },
}, async ({ orderCode, fromDate, untilDate }) => runTool("german_list_external_quantities", { orderCode, fromDate, untilDate }, () => listExternalQuantities(client, orderCode, fromDate, untilDate)));

const externalQuantitySchema = {
  orderCode: z.string().min(1).max(100),
  operationNumber: z.number().int().positive(),
  receivedDate: z.string(),
  quantity: z.number().positive(),
  sourceId: z.string().uuid().optional(),
  sourceName: z.string().max(200).optional(),
};

server.registerTool("german_preview_external_quantity", {
  description: "Preview trước khi ghi gia công ngoài; không thay đổi dữ liệu.",
  inputSchema: externalQuantitySchema,
}, async (input) => runTool("german_preview_external_quantity", input, () => previewExternalQuantity(client, input)));

server.registerTool("german_create_external_quantity", {
  description: "Ghi gia công ngoài sau khi đã xác nhận preview. Bắt buộc confirm=true.",
  inputSchema: { ...externalQuantitySchema, confirm: z.literal(true) },
}, async (input) => runTool("german_create_external_quantity", input, () => createExternalQuantity(client, input)));

server.registerTool("german_list_production_entries", {
  description: "Tra cứu sản lượng nội bộ theo ngày, nhân viên, mã sản xuất hoặc công đoạn.",
  inputSchema: {
    date: z.string().optional(),
    fromDate: z.string().optional(),
    untilDate: z.string().optional(),
    employeeId: z.string().uuid().optional(),
    orderCode: z.string().max(100).optional(),
    operationNumber: z.number().int().positive().optional(),
    search: z.string().max(200).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).optional(),
  },
}, async (input) => runTool("german_list_production_entries", input, () => listProductionEntries(client, input)));

const productionBatchItemSchema = z.object({
  operationNumber: z.number().int().positive(),
  directHcQuantity: z.number().nonnegative().optional(),
  directTcQuantity: z.number().nonnegative().optional(),
  totalQuantity: z.number().positive().optional(),
  note: z.string().max(500).optional(),
});

const productionBatchSchema = {
  workDate: z.string(),
  employeeId: z.string().uuid().optional(),
  employeeCode: z.string().max(100).optional(),
  employeeName: z.string().max(200).optional(),
  orderCode: z.string().min(1).max(100),
  items: z.array(productionBatchItemSchema).min(1).max(100),
};

server.registerTool("german_preview_production_batch", {
  description: "Preview nhập sản lượng nội bộ. Có thể truyền totalQuantity để MCP tự chia HC/TC theo giờ chấm công; không thay đổi dữ liệu.",
  inputSchema: productionBatchSchema,
}, async (input) => runTool("german_preview_production_batch", input, () => previewProductionBatch(client, { ...input, confirm: false })));

server.registerTool("german_create_production_batch", {
  description: "Ghi nhiều công đoạn sản lượng nội bộ trong một ngày qua API. Bắt buộc confirm=true; totalQuantity sẽ được chia theo HC/TC thực tế.",
  inputSchema: { ...productionBatchSchema, confirm: z.literal(true) },
}, async (input) => runTool("german_create_production_batch", input, () => createProductionBatch(client, input)));

const productionUpdateSchema = {
  entryId: z.string().min(1),
  version: z.number().int().positive(),
  workDate: z.string(),
  employeeId: z.string().uuid().optional(),
  employeeCode: z.string().max(100).optional(),
  employeeName: z.string().max(200).optional(),
  orderCode: z.string().min(1).max(100),
  operationNumber: z.number().int().positive(),
  directHcQuantity: z.number().nonnegative().optional(),
  directTcQuantity: z.number().nonnegative().optional(),
  totalQuantity: z.number().positive().optional(),
  note: z.string().max(500).optional(),
};

server.registerTool("german_preview_production_update", {
  description: "Preview sửa một entry sản lượng nội bộ theo entryId và version; không thay đổi dữ liệu.",
  inputSchema: productionUpdateSchema,
}, async (input) => runTool("german_preview_production_update", input, () => previewProductionEntryUpdate(client, { ...input, confirm: false })));

server.registerTool("german_update_production_entry", {
  description: "Sửa một entry sản lượng nội bộ. Bắt buộc đúng version hiện tại và confirm=true.",
  inputSchema: { ...productionUpdateSchema, confirm: z.literal(true) },
}, async (input) => runTool("german_update_production_entry", input, () => updateProductionEntry(client, input)));

server.registerTool("german_delete_production_entry", {
  description: "Xóa mềm một entry sản lượng nội bộ theo entryId và version. Bắt buộc confirm=true.",
  inputSchema: { entryId: z.string().min(1), version: z.number().int().positive(), confirm: z.literal(true) },
}, async (input) => runTool("german_delete_production_entry", input, () => deleteProductionEntry(client, input)));

const transport = new StdioServerTransport();
await server.connect(transport);
