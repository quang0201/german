import { describe, expect, test } from "bun:test";
import { validateExternalQuantityInput, validateProductionBatchInput, validateProductionEntryDeleteInput, validateProductionEntryUpdateInput } from "./validation.ts";

describe("MCP input validation", () => {
  test("accepts a confirmed external quantity request", () => {
    expect(validateExternalQuantityInput({
      orderCode: "4004 xanh",
      operationNumber: 3,
      receivedDate: "2026-09-05",
      quantity: 3443,
      sourceName: "Hà",
      confirm: true,
    })).toEqual({
      orderCode: "4004 xanh",
      operationNumber: 3,
      receivedDate: "2026-09-05",
      quantity: 3443,
      sourceName: "Hà",
      confirm: true,
    });
  });

  test("rejects writes without explicit confirmation", () => {
    expect(() => validateExternalQuantityInput({
      orderCode: "4004 xanh",
      operationNumber: 3,
      receivedDate: "2026-09-05",
      quantity: 3443,
      sourceName: "Hà",
      confirm: false,
    })).toThrow("confirm");
  });

  test("rejects invalid date, operation, quantity, and ambiguous source", () => {
    expect(() => validateExternalQuantityInput({
      orderCode: "4004 xanh",
      operationNumber: 0,
      receivedDate: "05/09/2026",
      quantity: 0,
      sourceId: "source-a",
      sourceName: "Hà",
      confirm: true,
    })).toThrow();
  });

  test("accepts a production batch with a total to split by attendance hours", () => {
    expect(validateProductionBatchInput({
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      items: [{ operationNumber: 1, totalQuantity: 2500 }],
      confirm: false,
    }, { requireConfirmation: false })).toMatchObject({
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      items: [{ operationNumber: 1, totalQuantity: 2500 }],
    });
  });

  test("rejects ambiguous employee selectors, duplicate operations, and unconfirmed writes", () => {
    expect(() => validateProductionBatchInput({
      workDate: "2026-09-11",
      employeeId: "employee-1",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      items: [{ operationNumber: 1, directHcQuantity: 100 }],
      confirm: true,
    })).toThrow("only one");

    expect(() => validateProductionBatchInput({
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      items: [
        { operationNumber: 1, directHcQuantity: 100 },
        { operationNumber: 1, directHcQuantity: 200 },
      ],
      confirm: true,
    })).toThrow("unique");

    expect(() => validateProductionBatchInput({
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      items: [{ operationNumber: 1, directHcQuantity: 100 }],
      confirm: false,
    })).toThrow("confirm");
  });

  test("validates production update and delete concurrency inputs", () => {
    expect(validateProductionEntryUpdateInput({
      entryId: "entry-1",
      version: 2,
      workDate: "2026-09-11",
      employeeCode: "0417-BHD",
      orderCode: "4004 đen",
      operationNumber: 1,
      directHcQuantity: 100,
      confirm: true,
    })).toMatchObject({ entryId: "entry-1", version: 2, items: [{ operationNumber: 1, directHcQuantity: 100 }] });
    expect(validateProductionEntryDeleteInput({ entryId: "entry-1", version: 2, confirm: true })).toEqual({ entryId: "entry-1", version: 2, confirm: true });
    expect(() => validateProductionEntryDeleteInput({ entryId: "entry-1", version: 1, confirm: false })).toThrow("confirm");
  });
});
