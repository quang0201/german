import { describe, expect, test } from "bun:test";
import { createExternalQuantity, createProductionBatch, deleteProductionEntry, previewExternalQuantity, previewProductionBatch, previewProductionEntryUpdate, updateProductionEntry } from "./toolHandlers.ts";

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

function productionClient() {
  const calls: Array<{ path: string; body?: unknown }> = [];
  return {
    calls,
    client: {
      async get(path: string) {
        calls.push({ path });
        if (path === "/api/employees/") return [{ id: "employee-1", employeeCode: "0417-BHD", fullName: "Bùi Huyền Dung", isActive: true }];
        if (path === "/api/production-orders") return [{
          id: "order-1", code: "4004 đen", productName: "Túi 4004 đen", operations: [
            { id: "operation-1", operationNumber: 1, name: "CĐ1", unit: "cái", isActive: true },
            { id: "operation-5", operationNumber: 5, name: "CĐ5", unit: "cái", isActive: true },
          ],
        }];
        if (path.startsWith("/api/lookups/attendance-hours")) return {
          employeeId: "employee-1", workDate: "2026-09-11", hasAttendance: true,
          regularHours: 8, overtimeHours: 3, paidLeaveHours: 0, sickLeaveHours: 0,
          shifts: [
            { slotNumber: 1, shiftName: "Ca 1", workedHours: 4, valueKind: "Hours" },
            { slotNumber: 2, shiftName: "Ca 2", workedHours: 4, valueKind: "Hours" },
          ],
        };
        return { items: [], summary: { totalQuantity: 0 } };
      },
      async post(path: string, body: unknown) {
        calls.push({ path, body });
        return { createdCount: 1, entries: [{ id: "entry-1", totalQuantity: 2500 }] };
      },
      async put(path: string, body: unknown) {
        calls.push({ path, body });
        return { id: "entry-1", version: 3, totalQuantity: 2600 };
      },
      async delete(path: string) {
        calls.push({ path });
        return null;
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

  test("previews internal production and splits total by actual regular/overtime hours", async () => {
    const { client } = productionClient();
    const preview = await previewProductionBatch(client, {
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      items: [{ operationNumber: 1, totalQuantity: 2500 }],
      confirm: false,
    });

    expect(preview.employee.fullName).toBe("Bùi Huyền Dung");
    expect(preview.items[0]).toMatchObject({
      operationNumber: 1,
      directHcQuantity: 1818.181818,
      directTcQuantity: 681.818182,
    });
    expect(preview.request.attendance.overtimeHours).toBe(3);
    expect(preview.confirmed).toBe(false);
  });

  test("creates internal production only after confirmation", async () => {
    const { client, calls } = productionClient();
    const result = await createProductionBatch(client, {
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      items: [{ operationNumber: 1, totalQuantity: 2500 }],
      confirm: true,
    });

    expect(result).toEqual({ createdCount: 1, entries: [{ id: "entry-1", totalQuantity: 2500 }] });
    expect(calls.at(-1)).toEqual({
      path: "/api/production-entries/batch-direct",
      body: expect.objectContaining({
        workDate: "2026-09-11",
        employeeId: "employee-1",
        productionOrderId: "order-1",
        items: [{
          productionOperationId: "operation-1",
          directHcQuantity: 1818.181818,
          directTcQuantity: 681.818182,
          note: null,
        }],
      }),
    });
  });

  test("previews and updates one internal production entry with its version", async () => {
    const { client, calls } = productionClient();
    const preview = await previewProductionEntryUpdate(client, {
      entryId: "entry-1",
      version: 2,
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      operationNumber: 1,
      totalQuantity: 2600,
      confirm: false,
    });
    expect(preview.request).toMatchObject({ version: 2, productionOperationId: "operation-1", directHcQuantity: 1890.909091, directTcQuantity: 709.090909 });

    await updateProductionEntry(client, { entryId: "entry-1", version: 2, workDate: "2026-09-11", employeeCode: "0417-BHD", orderCode: "4004 đen", operationNumber: 1, directHcQuantity: 2000, directTcQuantity: 600, confirm: true });
    expect(calls.at(-1)).toEqual({ path: "/api/production-entries/entry-1", body: expect.objectContaining({ version: 2, entryMode: "Direct", directHcQuantity: 2000, directTcQuantity: 600 }) });
  });

  test("deletes one internal production entry by version", async () => {
    const { client, calls } = productionClient();
    await deleteProductionEntry(client, { entryId: "entry-1", version: 2, confirm: true });
    expect(calls.at(-1)).toEqual({ path: "/api/production-entries/entry-1?version=2" });
  });
});
