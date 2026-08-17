import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeListPage } from "./EmployeeListPage.jsx";

describe("EmployeeListPage", () => {
  test("uses a popup trigger instead of inline employee creation fields", () => {
    const html = renderToStaticMarkup(<EmployeeListPage />);

    expect(html).toContain("+ Thêm nhân viên");
    expect(html).toContain("Tạo mới bằng popup");
    expect(html).not.toContain('id="employee-create"');
  });
});
