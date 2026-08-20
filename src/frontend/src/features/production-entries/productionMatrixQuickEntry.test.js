import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionMatrixQuickEntryDialog } from "./ProductionMatrixQuickEntryDialog.jsx";
import {
  canWriteQuickEntry,
  createQuickEntry,
  buildQuickEntryCreatePayload,
  buildQuickEntryPayload,
  isQuickEntryDetailCompatible,
  quickEntryExpectedVersion,
  quickEntryFeedbackMessage,
  shouldShowQuickEntryReload,
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
  test("loads attendance hours for a new hour-split entry without changing edit mode", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionMatrixQuickEntryDialog.jsx"), "utf8");

    expect(source).toContain("/api/lookups/attendance-hours");
    expect(source).toContain("attendanceHoursDefaults");
    expect(source).toContain("attendanceHoursEditedRef");
  });

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

  test("shows reload and blocks Save after a create conflict", () => {
    expect(shouldShowQuickEntryReload({ editing: false, loadingEntry: false, detailLoaded: true, conflict: true })).toBe(true);
    expect(canWriteQuickEntry({ editing: false, detailLoaded: true, saving: false, conflict: true })).toBe(false);
  });

  test("keeps the conflict reload feedback after the draft error is cleared", () => {
    expect(quickEntryFeedbackMessage({ error: "", conflictError: "Ô đã có dữ liệu." })).toBe("Ô đã có dữ liệu.");
    expect(shouldShowQuickEntryReload({ editing: false, loadingEntry: false, detailLoaded: true, conflict: true })).toBe(true);
    expect(canWriteQuickEntry({ editing: false, detailLoaded: true, saving: false, conflict: true })).toBe(false);
  });

  test("wires expectedEmpty into the real create request and preserves a 409 conflict", async () => {
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (path, options) => {
      request = { path, options };
      return new Response(JSON.stringify({ code: "production_entry.cell_conflict", message: "Ô đã có dữ liệu." }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      await expect(createQuickEntry({ ...buildQuickEntryCreatePayload({ workDate: "2026-08-27" }) })).rejects.toMatchObject({ status: 409, code: "production_entry.cell_conflict" });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(request.path).toBe("/api/production-entries");
    expect(JSON.parse(request.options.body).expectedEmpty).toBe(true);
  });

  test("persists hour-split results as a Direct payload", () => {
    const payload = buildQuickEntryPayload({
      context,
      quantities: { hc: 320, tc: 80 },
      editEntry: null,
      note: "  Chia theo giờ  ",
    });
    expect(payload).toMatchObject({
      entryMode: "Direct",
      directHcQuantity: 320,
      directTcQuantity: 80,
      note: "Chia theo giờ",
    });
  });

  test("renders edit actions disabled while the detail request is pending", () => {
    const html = renderToStaticMarkup(
      <ProductionMatrixQuickEntryDialog
        context={{ ...context, cell: { entryCount: 1, hcQuantity: 10, tcQuantity: 2, records: [record] } }}
        onClose={() => {}}
      />,
    );
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });

  test("defaults an existing entry to Direct while exposing both input modes", () => {
    const html = renderToStaticMarkup(
      <ProductionMatrixQuickEntryDialog
        context={{ ...context, cell: { entryCount: 1, hcQuantity: 10, tcQuantity: 2, records: [record] } }}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Nhập trực tiếp");
    expect(html).toContain("Chia đều theo giờ");
    expect(html).toContain('aria-pressed="true"');
  });
});
