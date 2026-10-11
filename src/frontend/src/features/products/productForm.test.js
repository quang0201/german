import { describe, expect, test } from "bun:test";
import { applyProductToDraft, buildProductPayload, emptyProduct, operationsFromTemplate, productForm, templateMismatch } from "./productForm.js";

const product = {
  id: "p1",
  code: "4004",
  name: "Túi 4004",
  isActive: true,
  operations: [
    { id: "t2", operationNumber: 2, name: "May thân", unit: "cái", fixedPrice: null, sortOrder: 2, isActive: true },
    { id: "t1", operationNumber: 1, name: "Cắt vải", unit: "cái", fixedPrice: 1200, sortOrder: 1, isActive: true },
    { id: "t9", operationNumber: 9, name: "Đã bỏ", unit: "cái", fixedPrice: null, sortOrder: 3, isActive: false },
  ],
};

describe("productForm", () => {
  test("emptyProduct starts active with no operations", () => {
    expect(emptyProduct()).toEqual({ code: "", name: "", isActive: true, operations: [] });
  });

  test("productForm turns the DTO into editable strings ordered by sortOrder", () => {
    const form = productForm(product);

    expect(form.code).toBe("4004");
    expect(form.operations.map((x) => x.operationNumber)).toEqual([1, 2, 9]);
    expect(form.operations[1].fixedPrice).toBe("");
  });

  test("buildProductPayload trims, converts numbers and renumbers sort order", () => {
    const payload = buildProductPayload({
      code: " 4004 ",
      name: " Túi 4004 ",
      isActive: true,
      operations: [
        { operationNumber: "5", name: " Lắp ráp ", unit: " cái ", fixedPrice: "1800", isActive: true },
        { operationNumber: "1", name: "Cắt", unit: "cái", fixedPrice: "", isActive: false },
      ],
    });

    expect(payload).toEqual({
      code: "4004",
      name: "Túi 4004",
      isActive: true,
      operations: [
        { operationNumber: 5, name: "Lắp ráp", unit: "cái", fixedPrice: 1800, sortOrder: 1, isActive: true },
        { operationNumber: 1, name: "Cắt", unit: "cái", fixedPrice: null, sortOrder: 2, isActive: false },
      ],
    });
  });
});

describe("operationsFromTemplate", () => {
  test("copies only active operations, in order, as editable draft rows", () => {
    expect(operationsFromTemplate(product)).toEqual([
      { operationNumber: 1, name: "Cắt vải", unit: "cái", fixedPrice: 1200, sortOrder: 1, isActive: true },
      { operationNumber: 2, name: "May thân", unit: "cái", fixedPrice: "", sortOrder: 2, isActive: true },
    ]);
  });

  test("returns an empty list when there is no product", () => {
    expect(operationsFromTemplate(null)).toEqual([]);
  });
});

describe("templateMismatch", () => {
  const order = (operations) => ({ operations });

  test("is null without a product and clean when the operations match", () => {
    expect(templateMismatch(order([]), null)).toBeNull();
    const clean = templateMismatch(order([
      { operationNumber: 1, name: "Cắt vải", isActive: true },
      { operationNumber: 2, name: "may thân", isActive: true },
    ]), product);
    expect(clean).toEqual({ isDifferent: false, missing: [], extra: [], renamed: [] });
  });

  test("lists missing, extra and renamed operations", () => {
    const result = templateMismatch(order([
      { operationNumber: 1, name: "Cắt khác", isActive: true },
      { operationNumber: 8, name: "Đóng gói", isActive: true },
      { operationNumber: 7, name: "Đã tắt", isActive: false },
    ]), product);

    expect(result.isDifferent).toBe(true);
    expect(result.missing).toEqual([2]);
    expect(result.extra).toEqual([8]);
    expect(result.renamed).toEqual([{ operationNumber: 1, orderName: "Cắt khác", templateName: "Cắt vải" }]);
  });
});

describe("applyProductToDraft", () => {
  const draft = { code: "4004 xanh", productName: "", productId: "", operations: [{ operationNumber: 99, name: "Cũ", unit: "cái", fixedPrice: "", isActive: true }] };

  test("create mode links the product, fills an empty name and replaces the draft operations with the template", () => {
    const next = applyProductToDraft(draft, product, { copyOperations: true });

    expect(next.productId).toBe("p1");
    expect(next.productName).toBe("Túi 4004");
    expect(next.operations.map((x) => x.operationNumber)).toEqual([1, 2]);
  });

  test("keeps a name the user already typed", () => {
    expect(applyProductToDraft({ ...draft, productName: "Túi 4004 xanh" }, product, { copyOperations: true }).productName).toBe("Túi 4004 xanh");
  });

  test("edit mode only links the product and leaves operations alone", () => {
    const next = applyProductToDraft({ ...draft, productName: "Giữ" }, product, { copyOperations: false });

    expect(next.productId).toBe("p1");
    expect(next.productName).toBe("Giữ");
    expect(next.operations).toEqual(draft.operations);
  });

  test("clearing the product keeps what the draft already has", () => {
    const next = applyProductToDraft({ ...draft, productId: "p1" }, null, { copyOperations: true });

    expect(next.productId).toBe("");
    expect(next.operations).toEqual(draft.operations);
  });
});
