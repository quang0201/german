import React from "react";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { resolve } from "node:path";
import { EmployeeListPage } from "./EmployeeListPage.jsx";

describe("EmployeeListPage", () => {
  test("uses a popup trigger instead of inline employee creation fields", () => {
    const html = renderToStaticMarkup(<EmployeeListPage />);

    expect(html).toContain("+ Thêm nhân viên");
    expect(html).toContain("Tạo mới bằng popup");
    expect(html).not.toContain('id="employee-create"');
  });

  test("loads employees independently from shift templates", () => {
    const source = readFileSync(resolve(import.meta.dir, "EmployeeListPage.jsx"), "utf8");

    expect(source).toContain('api.get("/api/employees").then(setRows)');
    expect(source).toContain('api.get("/api/shift-templates")');
    expect(source).not.toContain("Promise.all([api.get(\"/api/employees\")");
  });

  test("offers a delete action backed by the employee delete endpoint", () => {
    const source = readFileSync(resolve(import.meta.dir, "EmployeeListPage.jsx"), "utf8");

    expect(source).toContain('api.delete(`/api/employees/${row.id}`)');
    expect(source).toContain("Xóa");
    expect(source).toContain("Xác nhận xóa nhân viên");
    expect(source).toContain("<ConfirmDialog");
    expect(source).not.toContain("window.confirm");
  });
});
