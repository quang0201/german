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
    expect(html).toContain("Bộ ca hiện tại được hiển thị trực tiếp");
    expect(html).not.toContain('id="employee-create"');
  });

  test("loads employees independently from shift templates", () => {
    const source = readFileSync(resolve(import.meta.dir, "EmployeeListPage.jsx"), "utf8");

    expect(source).toContain('api.get("/api/employees")');
    expect(source).toContain("currentShift");
    expect(source).toContain('api.get("/api/shift-templates")');
    expect(source).not.toContain("Promise.all([api.get(\"/api/employees\")");
  });

  test("offers a delete action backed by the employee delete endpoint", () => {
    const source = readFileSync(resolve(import.meta.dir, "EmployeeListPage.jsx"), "utf8");

    expect(source).toContain('api.delete(`/api/employees/${row.id}`)');
    expect(source).toContain("Tắt");
    expect(source).toContain("Xác nhận tắt nhân viên");
    expect(source).toContain("<ConfirmDialog");
    expect(source).not.toContain("window.confirm");
  });

  test("offers shift reassignment from the employee edit flow", () => {
    const source = readFileSync(resolve(import.meta.dir, "EmployeeListPage.jsx"), "utf8");

    expect(source).toContain('api.post(`/api/employees/${editingEmployee.id}/shift-assignments`');
    expect(source).toContain("onAssignShift");
    expect(source).toContain("assignmentSaving");
  });

  test("keeps the displayed current shift when profile update response omits it", () => {
    const source = readFileSync(resolve(import.meta.dir, "EmployeeListPage.jsx"), "utf8");

    expect(source).toContain("currentShift: updated.currentShift ?? row.currentShift");
  });
});
