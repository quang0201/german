import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { buildProductionOrderPayload, formatFixedPrice, productionOrderDetailForm, resolveProductionOrderDetailDraft, resolveProductionOrderView, shouldLoadProductionOrderList, shouldResetProductionOrderCreateDraft } from "./productionOrderForm.js";

const orderPageSource = readFileSync(resolve(import.meta.dir, "ProductionOrderListPage.jsx"), "utf8");

describe("production order form", () => {
  test("builds a create payload with operations and fixed prices", () => {
    expect(buildProductionOrderPayload({
      code: " sx-01 ",
      productName: " Áo A ",
      plannedQuantity: "1000",
      status: "Draft",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      operations: [{ operationNumber: "10", name: " Cắt ", unit: " cái ", fixedPrice: "25000", sortOrder: "1", isActive: true }],
    })).toEqual({
      code: "sx-01",
      productName: "Áo A",
      plannedQuantity: 1000,
      status: "Draft",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      operations: [{ operationNumber: 10, name: "Cắt", unit: "cái", fixedPrice: 25000, sortOrder: 1, isActive: true }],
    });
  });

  test("formats missing fixed prices as not configured", () => {
    expect(formatFixedPrice(null)).toBe("Chưa thiết lập");
    expect(formatFixedPrice(25000.5)).toContain("25.000,5");
  });

  test("preserves an unsaved order draft during operation refresh", () => {
    const serverOrder = {
      code: "SX-01",
      productName: "Áo A",
      plannedQuantity: 1000,
      status: "Draft",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    };
    const draft = { ...productionOrderDetailForm(serverOrder), productName: "Áo A — đang sửa" };

    expect(resolveProductionOrderDetailDraft(serverOrder, draft, true)).toBe(draft);
    expect(resolveProductionOrderDetailDraft(serverOrder, draft, false)).toEqual(productionOrderDetailForm(serverOrder));
  });

  test("keeps the order list separate from the create route", () => {
    expect(resolveProductionOrderView("/orders")).toBe("list");
    expect(resolveProductionOrderView("/orders/new")).toBe("create");
    expect(resolveProductionOrderView("/orders/abc-123", "abc-123")).toBe("detail");
  });

  test("only loads the order list on the list route", () => {
    expect(shouldLoadProductionOrderList("list")).toBe(true);
    expect(shouldLoadProductionOrderList("create")).toBe(false);
    expect(shouldLoadProductionOrderList("detail")).toBe(false);
  });

  test("resets create drafts only when entering the create route", () => {
    expect(shouldResetProductionOrderCreateDraft("list", "create")).toBe(true);
    expect(shouldResetProductionOrderCreateDraft("detail", "create")).toBe(true);
    expect(shouldResetProductionOrderCreateDraft("create", "create")).toBe(false);
    expect(shouldResetProductionOrderCreateDraft("create", "list")).toBe(false);
  });

  test("offers confirmed deletion for an operation and its related production data", () => {
    expect(orderPageSource).toContain("api.delete(`/api/production-orders/${selected.id}/operations/${item.id}`)");
    expect(orderPageSource).toContain("Xóa toàn bộ dữ liệu liên quan");
    expect(orderPageSource).toContain("Xác nhận xóa");
  });
});
