import { describe, expect, test } from "bun:test";
import {
  canWriteQuickEntry,
  isQuickEntryDetailCompatible,
  quickEntryExpectedVersion,
} from "./productionMatrixQuickEntry.js";

const context = {
  workDate: "2026-08-27",
  employee: { employeeId: "employee-1" },
  order: { orderId: "order-1" },
  operation: { operationId: "operation-1" },
};

const record = { id: "entry-1", version: 3, entryMode: "Direct" };

const detail = {
  id: "entry-1",
  version: 3,
  entryMode: "Direct",
  workDate: "2026-08-27",
  employeeId: "employee-1",
  productionOrderId: "order-1",
  productionOperationId: "operation-1",
};

describe("production matrix quick entry guards", () => {
  test("accepts detail only when snapshot version, mode, and matrix key still match", () => {
    expect(isQuickEntryDetailCompatible({ record, context, detail })).toBe(true);
    expect(isQuickEntryDetailCompatible({ record, context, detail: { ...detail, version: 4 } })).toBe(false);
    expect(isQuickEntryDetailCompatible({ record, context, detail: { ...detail, entryMode: "ByShift" } })).toBe(false);
    expect(isQuickEntryDetailCompatible({ record, context, detail: { ...detail, productionOperationId: "operation-2" } })).toBe(false);
  });

  test("keeps the matrix snapshot version as the write precondition", () => {
    expect(quickEntryExpectedVersion(record)).toBe(3);
    expect(quickEntryExpectedVersion(record, { ...detail, version: 4 })).toBe(3);
  });

  test("does not allow edit writes until detail loading succeeds", () => {
    expect(canWriteQuickEntry({ editing: true, detailLoaded: false, saving: false })).toBe(false);
    expect(canWriteQuickEntry({ editing: true, detailLoaded: true, saving: false })).toBe(true);
    expect(canWriteQuickEntry({ editing: false, detailLoaded: false, saving: false })).toBe(true);
    expect(canWriteQuickEntry({ editing: true, detailLoaded: true, saving: true })).toBe(false);
  });
});
