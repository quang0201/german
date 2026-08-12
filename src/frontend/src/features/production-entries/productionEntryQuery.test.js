import { describe, expect, test } from "bun:test";
import { buildProductionEntryListQuery, normalizeProductionEntryListResponse } from "./productionEntryQuery.js";

describe("production entry list query", () => {
  test("serializes server filters and pagination", () => {
    expect(buildProductionEntryListQuery({
      fromDate: "2026-08-01",
      untilDate: "2026-08-12",
      employeeId: "employee-1",
      orderId: "order-1",
      operationId: "operation-1",
      search: "  E001  ",
      page: 2,
      pageSize: 100,
    })).toBe("/api/production-entries?fromDate=2026-08-01&untilDate=2026-08-12&employeeId=employee-1&orderId=order-1&operationId=operation-1&search=E001&page=2&pageSize=100");
  });

  test("normalizes a fixed paged response shape", () => {
    expect(normalizeProductionEntryListResponse({ items: null })).toEqual({
      items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0,
    });
  });
});
