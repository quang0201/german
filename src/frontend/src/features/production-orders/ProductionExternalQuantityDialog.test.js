import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ProductionExternalQuantityDialog } from "./ProductionExternalQuantityDialog.jsx";

describe("ProductionExternalQuantityDialog", () => {
  test("renders read-only order/operation context and external quantity fields", () => {
    const html = renderToString(React.createElement(ProductionExternalQuantityDialog, {
      open: true,
      order: { code: "0417" },
      operation: { operationNumber: 4, name: "May thân", unit: "cái" },
      onClose: () => {},
    }));

    expect(html).toContain("Bổ sung sản lượng ngoài");
    expect(html).toContain("0417");
    expect(html).toContain("CĐ");
    expect(html).toContain("May thân");
    expect(html).toContain("Ngày nhận");
    expect(html).toContain("Nguồn bên ngoài");
    expect(html).toContain("Ghi nhận");
  });

  test("renders edit mode with existing quantity and API error inside popup", () => {
    const html = renderToString(React.createElement(ProductionExternalQuantityDialog, {
      open: true,
      order: { code: "0417" },
      operation: { operationNumber: 4, name: "May thân", unit: "cái" },
      item: { receivedDate: "2026-08-22", quantity: 5000, sourceName: "Xưởng A", note: "Nhận hàng" },
      error: "Số lượng phải lớn hơn 0.",
      onClose: () => {},
    }));

    expect(html).toContain("Sửa sản lượng nhận ngoài");
    expect(html).toContain('value="5000"');
    expect(html).toContain("Số lượng phải lớn hơn 0.");
    expect(html).toContain("Lưu thay đổi");
  });
});
