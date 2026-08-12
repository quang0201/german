import { describe, expect, test } from "bun:test";
import { actionLabel, entryModeLabel, orderStatusLabel, roleLabel } from "./i18n.js";

describe("Vietnamese UI labels", () => {
  test("maps backend enum values to Vietnamese labels", () => {
    expect(roleLabel("Admin")).toBe("Quản trị viên");
    expect(entryModeLabel("ByShift")).toBe("Theo ca");
    expect(orderStatusLabel("InProduction")).toBe("Đang sản xuất");
    expect(actionLabel("Create")).toBe("Tạo mới");
  });
});
