import { describe, expect, test } from "bun:test";
import { buildProductionOrderPayload, formatFixedPrice, productionOrderDetailForm, resolveProductionOrderDetailDraft } from "./productionOrderForm.js";

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
});
