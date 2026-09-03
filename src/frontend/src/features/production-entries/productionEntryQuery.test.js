import { describe, expect, test } from "bun:test";
import {
  buildProductionEntryListQuery,
  buildProductionExportUrl,
  normalizeProductionEntryListResponse,
} from "./productionEntryQuery.js";

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

  test("normalizes a fixed paged response shape and absent summary values", () => {
    expect(normalizeProductionEntryListResponse({ items: null })).toEqual({
      items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0,
      summary: { employeeCount: 0, entryCount: 0, hcQuantity: 0, tcQuantity: 0, totalQuantity: 0 },
    });
  });

  test("normalizes every production summary value", () => {
    expect(normalizeProductionEntryListResponse({
      summary: { employeeCount: 2, entryCount: 3, hcQuantity: 12.5, tcQuantity: 2.25, totalQuantity: 14.75 },
    }).summary).toEqual({ employeeCount: 2, entryCount: 3, hcQuantity: 12.5, tcQuantity: 2.25, totalQuantity: 14.75 });
  });

  test("serializes every applied export filter without pagination", () => {
    expect(buildProductionExportUrl({
      fromDate: "2026-08-01",
      untilDate: "2026-08-12",
      employeeId: "employee-1",
      orderId: "order-1",
      operationId: "operation-1",
      search: "  E001 & CĐ2  ",
      excludeSundays: true,
      page: 2,
      pageSize: 100,
    })).toBe("/api/reports/production/export.xlsx?fromDate=2026-08-01&untilDate=2026-08-12&employeeId=employee-1&orderId=order-1&operationId=operation-1&search=E001+%26+C%C4%902&excludeSundays=true");
  });

  test("serializes false Sunday exclusion only for exports", () => {
    expect(buildProductionExportUrl({
      fromDate: "2026-08-01",
      untilDate: "2026-08-12",
      excludeSundays: false,
    })).toContain("excludeSundays=false");

    expect(buildProductionEntryListQuery({
      fromDate: "2026-08-01",
      untilDate: "2026-08-12",
      excludeSundays: true,
    })).not.toContain("excludeSundays");
  });
});
