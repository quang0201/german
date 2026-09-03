import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable } from "./DataTable.jsx";
import { Field } from "./Field.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

describe("ERP shared components", () => {
  test("StatusBadge only renders the supplied semantic variant", () => {
    const html = renderToStaticMarkup(<StatusBadge variant="success">Đang hoạt động</StatusBadge>);
    expect(html).toContain("erp-status-success");
    expect(html).toContain("Đang hoạt động");
  });

  test("DataTable renders loading, error and empty states", () => {
    expect(renderToStaticMarkup(<DataTable columns={[]} rows={[]} loading />)).toContain("Đang tải dữ liệu");
    expect(renderToStaticMarkup(<DataTable columns={[]} rows={[]} error="Thử lại" />)).toContain("Thử lại");
    expect(renderToStaticMarkup(<DataTable columns={[]} rows={[]} emptyMessage="Không có bản ghi" />)).toContain("Không có bản ghi");
  });

  test("Field renders an inline error and required marker", () => {
    const html = renderToStaticMarkup(<Field label="Sản lượng" required error="Bắt buộc"><input /></Field>);
    expect(html).toContain("erp-field-error");
    expect(html).toContain("Bắt buộc");
    expect(html).toContain("erp-required");
  });
});
