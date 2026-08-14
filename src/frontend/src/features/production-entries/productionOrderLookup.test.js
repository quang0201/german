import { describe, expect, test } from "bun:test";
import { productionOrderLookupPath } from "./productionOrderLookup.js";

describe("production order lookup", () => {
  test("uses the full production order list for managers and admins", () => {
    expect(productionOrderLookupPath(true)).toBe("/api/production-orders");
  });

  test("uses active production orders for workers", () => {
    expect(productionOrderLookupPath(false)).toBe("/api/lookups/production-orders/active");
  });
});
