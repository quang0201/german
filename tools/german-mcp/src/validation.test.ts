import { describe, expect, test } from "bun:test";
import { validateExternalQuantityInput } from "./validation.ts";

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
});
