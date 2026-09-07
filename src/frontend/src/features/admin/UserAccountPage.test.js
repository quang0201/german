import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "UserAccountPage.jsx"), "utf8");

describe("UserAccountPage", () => {
  test("offers account deletion through a confirmation popup", () => {
    expect(source).toContain('api.delete(`/api/admin/user-accounts/${row.id}`)');
    expect(source).toContain("Xác nhận xóa tài khoản");
    expect(source).toContain("<ConfirmDialog");
    expect(source).not.toContain("window.confirm");
  });
});
