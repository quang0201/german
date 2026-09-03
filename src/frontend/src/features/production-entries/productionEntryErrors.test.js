import { describe, expect, test } from "bun:test";
import { isVersionConflict, mapProductionEntryError } from "./productionEntryErrors.js";

describe("production entry feedback mapping", () => {
  test("maps version conflicts to the shared reload message", () => {
    expect(isVersionConflict({ status: 409 })).toBe(true);
    expect(mapProductionEntryError({ status: 409 })).toBe("Dữ liệu đã được thay đổi bởi người khác.");
  });

  test("does not expose unknown backend errors without a message", () => {
    expect(mapProductionEntryError({ status: 500 })).toBe("Không thể hoàn tất thao tác.");
  });
});
