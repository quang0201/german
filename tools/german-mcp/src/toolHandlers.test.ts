import { describe, expect, test } from "bun:test";
import { createExternalQuantity, previewExternalQuantity } from "./toolHandlers.ts";

function fakeClient() {
  const calls: Array<{ path: string; body?: unknown }> = [];
  return {
    calls,
    client: {
      async get(path: string) {
        calls.push({ path });
        if (path === "/api/production-orders") return [{ id: "order-1", code: "4004 xanh", productName: "Sản phẩm", operations: [{ id: "operation-3", operationNumber: 3, name: "May", unit: "cái" }] }];
        return [{ id: "source-1", name: "Hà", isActive: true }];
      },
      async post(path: string, body: unknown) {
        calls.push({ path, body });
        return { id: "external-1", quantity: 3443 };
      },
    } as any,
  };
}

describe("German HR MCP tool handlers", () => {
  test("previews by order code, operation number, and configured source", async () => {
    const { client } = fakeClient();
    const preview = await previewExternalQuantity(client, {
      orderCode: "4004 xanh",
      operationNumber: 3,
      receivedDate: "2026-09-05",
      quantity: 3443,
      sourceName: "Hà",
    });

    expect(preview.order.code).toBe("4004 xanh");
    expect(preview.operation.id).toBe("operation-3");
    expect(preview.source).toEqual({ id: "source-1", name: "Hà" });
    expect(preview.confirmed).toBe(false);
  });

  test("writes only after confirmation and uses resolved ids", async () => {
    const { client, calls } = fakeClient();
    const result = await createExternalQuantity(client, {
      orderCode: "4004 xanh",
      operationNumber: 3,
      receivedDate: "2026-09-05",
      quantity: 3443,
      sourceName: "Hà",
      confirm: true,
    });

    expect(result).toEqual({ id: "external-1", quantity: 3443 });
    expect(calls.at(-1)).toEqual({
      path: "/api/production-external-quantities",
      body: {
        productionOrderId: "order-1",
        productionOperationId: "operation-3",
        receivedDate: "2026-09-05",
        quantity: 3443,
        externalSourceId: "source-1",
        sourceName: null,
        note: null,
      },
    });
  });
});
