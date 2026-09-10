import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AuditLogger } from "./auditLogger.ts";
import { loadConfig } from "./config.ts";
import { GermanApiClient } from "./germanApiClient.ts";
import { createExternalQuantity, findProductionOrders, listExternalQuantities, listExternalSources, previewExternalQuantity } from "./toolHandlers.ts";

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

const transport = new StdioServerTransport();
await server.connect(transport);
