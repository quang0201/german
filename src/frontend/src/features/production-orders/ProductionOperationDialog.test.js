import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionOperationDialog } from "./ProductionOperationDialog.jsx";

describe("ProductionOperationDialog", () => {
  test("does not render when closed", () => {
    expect(renderToStaticMarkup(<ProductionOperationDialog open={false} />)).toBe("");
  });

  test("renders create mode with required operation fields", () => {
    const html = renderToStaticMarkup(<ProductionOperationDialog open onClose={() => {}} onSubmit={() => {}} />);

    expect(html).toContain("Thêm công đoạn");
    expect(html).toContain("Số công đoạn");
    expect(html).toContain("Giá cố định");
    expect(html).toContain('type="checkbox"');
  });

  test("renders edit mode with existing operation values", () => {
    const html = renderToStaticMarkup(<ProductionOperationDialog open mode="edit" operation={{ operationNumber: 20, name: "May", unit: "cái", fixedPrice: 40000, isActive: false }} onClose={() => {}} onSubmit={() => {}} />);

    expect(html).toContain("Sửa công đoạn");
    expect(html).toContain('value="May"');
    expect(html).toContain('value="40000"');
    expect(html).toContain("Lưu thay đổi");
  });
});
