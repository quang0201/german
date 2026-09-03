import { describe, expect, test } from "bun:test";
import { buildProductionEntryQuery, buildDirectUpdatePayload } from "./productionEntryManagement.js";

describe("production entry management helpers", () => {
  test("buildProductionEntryQuery only includes active filters", () => {
    expect(buildProductionEntryQuery({
      date: "2026-08-11",
      employeeId: "employee-1",
      orderId: "",
      operationId: null,
    })).toBe("/api/production-entries?date=2026-08-11&employeeId=employee-1");
  });

  test("buildDirectUpdatePayload preserves entry identity and version", () => {
    const entry = {
      version: 3,
      workDate: "2026-08-11",
      employeeId: "employee-1",
      productionOrderId: "order-1",
      productionOperationId: "operation-1",
      workStart: "07:00:00",
      workEnd: "17:00:00",
      note: "old",
    };

    expect(buildDirectUpdatePayload(entry, 535, 135, "đã chỉnh")).toEqual({
      version: 3,
      workDate: "2026-08-11",
      employeeId: "employee-1",
      productionOrderId: "order-1",
      productionOperationId: "operation-1",
      entryMode: "Direct",
      shift1Quantity: null,
      shift2Quantity: null,
      directHcQuantity: 535,
      directTcQuantity: 135,
      totalInputQuantity: null,
      overtimeHours: null,
      overtimeQuantity: null,
      workStart: "07:00:00",
      workEnd: "17:00:00",
      note: "đã chỉnh",
    });
  });
});
