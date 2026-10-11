import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionOrderDialog } from "./ProductionOrderDialog.jsx";

describe("ProductionOrderDialog", () => {
  const draft = {
    code: "0417",
    productName: "Áo mẫu",
    plannedQuantity: 22000,
    status: "Draft",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    operations: [{ operationNumber: 1, name: "Cắt", unit: "cái", fixedPrice: 1000, isActive: true }],
  };

  test("renders create fields and operation list in a popup", () => {
    const html = renderToStaticMarkup(<ProductionOrderDialog mode="create" open draft={draft} onClose={() => {}} onSubmit={() => {}} />);

    expect(html).toContain("Tạo mã sản xuất");
    expect(html).toContain("0417");
    expect(html).toContain("CĐ1");
    expect(html).toContain("+ Thêm công đoạn");
  });

  test("renders edit mode without the create-only operation editor", () => {
    const html = renderToStaticMarkup(<ProductionOrderDialog mode="edit" open draft={draft} onClose={() => {}} onSubmit={() => {}} />);

    expect(html).toContain("Sửa mã sản xuất");
    expect(html).toContain("Lưu thay đổi");
    expect(html).not.toContain("+ Thêm công đoạn");
  });

  test("offers a product template select that only copies operations when creating", () => {
    const products = [{ id: "p1", code: "4004", name: "Túi 4004", isActive: true }, { id: "p2", code: "OLD", name: "Cũ", isActive: false }];
    const create = renderToStaticMarkup(<ProductionOrderDialog mode="create" open draft={{ ...draft, productId: "p1" }} products={products} onClose={() => {}} onSubmit={() => {}} />);
    const edit = renderToStaticMarkup(<ProductionOrderDialog mode="edit" open draft={{ ...draft, productId: "p1" }} products={products} onClose={() => {}} onSubmit={() => {}} />);

    expect(create).toContain("Khuôn mẫu sản phẩm");
    expect(create).toContain("4004 · Túi 4004");
    expect(create).not.toContain("OLD · Cũ");
    expect(create).toContain("Công đoạn được sao chép từ sản phẩm");
    expect(edit).toContain("Khuôn mẫu sản phẩm");
    expect(edit).toContain("Chỉ gắn liên kết, không đổi công đoạn");
  });
});
