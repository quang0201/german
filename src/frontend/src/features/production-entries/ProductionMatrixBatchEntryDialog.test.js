import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { firstActiveEmployeeId, initialBatchOrderId, ProductionMatrixBatchEntryDialog } from "./ProductionMatrixBatchEntryDialog.jsx";
import { isCurrentBatchOperationsRequest, isCurrentBatchOrdersRequest } from "./productionMatrixBatch.js";

describe("ProductionMatrixBatchEntryDialog helpers", () => {
  test("defaults to the first active employee instead of an inactive first row", () => {
    expect(firstActiveEmployeeId([
      { id: "inactive-1", isActive: false },
      { id: "active-1", isActive: true },
      { id: "active-2", isActive: true },
    ])).toBe("active-1");
    expect(firstActiveEmployeeId([{ id: "active-default" }])).toBe("active-default");
    expect(firstActiveEmployeeId([{ id: "inactive-only", isActive: false }])).toBe("");
  });

  test("ignores operations from an obsolete order request", () => {
    expect(isCurrentBatchOperationsRequest(false, "order-a", "order-b")).toBe(false);
    expect(isCurrentBatchOperationsRequest(true, "order-a", "order-b")).toBe(false);
    expect(isCurrentBatchOperationsRequest(true, "order-b", "order-b")).toBe(true);
  });

  test("ignores production orders from an obsolete day request", () => {
    const dayA = { isoDate: "2026-08-01", preferredOrderId: "order-a" };
    const dayB = { isoDate: "2026-08-02", preferredOrderId: "order-b" };

    expect(isCurrentBatchOrdersRequest(false, dayA, dayB)).toBe(false);
    expect(isCurrentBatchOrdersRequest(true, dayA, dayB)).toBe(false);
    expect(isCurrentBatchOrdersRequest(true, dayB, dayB)).toBe(true);
  });

  test("prefers the selected matrix order when it is available for batch entry", () => {
    expect(initialBatchOrderId([{ id: "order-1" }, { id: "order-2" }], "order-2")).toBe("order-2");
    expect(initialBatchOrderId([{ id: "order-1" }], "missing-order")).toBe("");
  });

  test("explains the required order then operation selection flow", () => {
    const html = renderToStaticMarkup(<ProductionMatrixBatchEntryDialog day={{ isoDate: "2026-08-01", weekdayLabel: "T7", displayDate: "01/08" }} employees={[]} />);

    expect(html).toContain("Bước 1: Chọn Mã SX");
    expect(html).toContain("Bước 2: Chọn công đoạn");
    expect(html).toContain("Chọn Mã SX ở bước 1 để tải công đoạn.");
  });
});
