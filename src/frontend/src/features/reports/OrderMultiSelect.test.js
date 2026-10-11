import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { OrderMultiSelect } from "./OrderMultiSelect.jsx";

const orders = [
  { id: "a", code: "4004 xanh", productName: "Túi 4004 xanh", productCode: "4004" },
  { id: "b", code: "4004 đen", productName: "Túi 4004 đen", productCode: "4004" },
  { id: "c", code: "0417", productName: "Túi 0417", productCode: null },
];

describe("OrderMultiSelect", () => {
  test("shows the placeholder, the single order, or the first order plus a count", () => {
    const render = (selectedIds, loading = false) => renderToString(React.createElement(OrderMultiSelect, { orders, selectedIds, loading }));

    expect(render([])).toContain("Chọn Mã SX");
    expect(render([], true)).toContain("Đang tải Mã SX...");
    expect(render(["a"])).toContain("4004 xanh — Túi 4004 xanh");
    expect(render(["a", "b", "c"])).toContain("4004 xanh +2");
  });

  test("opens into product groups with checkboxes and the selection limit hint", () => {
    const html = renderToString(React.createElement(OrderMultiSelect, { orders, selectedIds: ["a"], initialOpen: true }));

    expect(html).toContain("4004 (2 mã)");
    expect(html).toContain("Chưa gắn sản phẩm (1 mã)");
    expect(html).toContain("Chọn nhiều mã để cộng gộp theo số công đoạn");
    expect(html.match(/type="checkbox"/g)?.length).toBe(5);
    expect(html).toContain('checked=""');
  });
});
