import { describe, expect, test } from "bun:test";
import { exportRangeError, listRangeError } from "./productionExport.js";

describe("production export date range", () => {
  test("allows a 32-day export while the list remains independently limited", () => {
    expect(exportRangeError("2026-01-01", "2026-02-01")).toBe("");
  });

  test("allows the inclusive 366-day export boundary", () => {
    expect(exportRangeError("2026-01-01", "2027-01-01")).toBe("");
  });

  test("rejects only ranges longer than 366 inclusive days", () => {
    expect(exportRangeError("2026-01-01", "2027-01-02")).toBe("Khoảng ngày export tối đa 366 ngày.");
  });

  test("keeps invalid and reversed ranges invalid", () => {
    expect(exportRangeError("", "2026-01-01")).toBe("Chọn đầy đủ từ ngày và đến ngày.");
    expect(exportRangeError("2026-02-01", "2026-01-01")).toBe("Từ ngày phải trước hoặc bằng đến ngày.");
  });

  test("keeps the list limited to 31 inclusive days", () => {
    expect(listRangeError("2026-01-01", "2026-01-31")).toBe("");
    expect(listRangeError("2026-01-01", "2026-02-01")).toBe("Khoảng ngày danh sách tối đa 31 ngày.");
  });
});
