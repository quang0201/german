import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "ShiftListPage.jsx"), "utf8");

describe("ShiftListPage", () => {
  test("uses popup forms for create and delete confirmation", () => {
    expect(source).toContain('<ShiftTemplateDialog mode="create"');
    expect(source).toContain('api.put(`/api/shift-templates/${row.id}`, payload)');
    expect(source).toContain("Xác nhận xóa bộ ca");
    expect(source).toContain("<ConfirmDialog");
    expect(source).not.toContain('id="shift-create"');
  });
});
