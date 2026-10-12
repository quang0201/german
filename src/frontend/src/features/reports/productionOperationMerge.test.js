import { describe, expect, test } from "bun:test";
import { MAX_REPORT_ORDERS, buildOrderParam, groupOrdersByProduct, mergeOperationSummaries, parseOrderParam, toggleGroupSelection, toggleOrderSelection } from "./productionOperationMerge.js";

function operation(number, name, quantities, extra = {}) {
  const [hc, tc, external = 0] = quantities;
  return {
    operationId: `op-${number}-${name}`,
    operationNumber: number,
    name,
    unit: "cái",
    hcQuantity: hc,
    tcQuantity: tc,
    totalQuantity: hc + tc,
    externalQuantity: external,
    combinedTotalQuantity: hc + tc + external,
    contributors: [],
    ...extra,
  };
}

function summary(orderId, orderCode, operations) {
  return { orderId, orderCode, productName: `Túi ${orderCode}`, operationCount: operations.length, operations };
}

const orders = [
  { id: "a", code: "4004 xanh", plannedQuantity: 1000 },
  { id: "b", code: "4004 đen", plannedQuantity: 500 },
  { id: "c", code: "TÚI 4004 đỏ", plannedQuantity: 200 },
];

describe("mergeOperationSummaries", () => {
  const merged = mergeOperationSummaries([
    summary("a", "4004 xanh", [operation(1, "Cắt", [100, 10]), operation(2, "May", [50, 0, 5]), operation(5, "Lắp", [20, 0])]),
    summary("b", "4004 đen", [operation(1, "Cắt", [40, 0]), operation(2, "May thân", [30, 5]), operation(5, "Lắp", [10, 0])]),
    summary("c", "TÚI 4004 đỏ", [operation(8, "Đóng gói", [7, 0]), operation(9, "Kiểm", [3, 0])]),
  ], orders);

  test("takes the union of operation numbers in ascending order", () => {
    expect(merged.operations.map((x) => x.operationNumber)).toEqual([1, 2, 5, 8, 9]);
    expect(merged.operationCount).toBe(5);
  });

  test("sums HC, TC, internal, external and combined totals by operation number", () => {
    const first = merged.operations[0];

    expect(first.hcQuantity).toBe(140);
    expect(first.tcQuantity).toBe(10);
    expect(first.totalQuantity).toBe(150);
    const second = merged.operations[1];
    expect(second.externalQuantity).toBe(5);
    expect(second.combinedTotalQuantity).toBe(90);
  });

  test("keeps the first name and lists the other names when they differ", () => {
    expect(merged.operations[0].name).toBe("Cắt");
    expect(merged.operations[0].extraNames).toEqual([]);
    expect(merged.operations[1].name).toBe("May");
    expect(merged.operations[1].extraNames).toEqual(["May thân"]);
  });

  test("breaks every operation down by order, in selection order, skipping orders without it", () => {
    expect(merged.operations[0].byOrder.map((x) => [x.orderCode, x.totalQuantity])).toEqual([["4004 xanh", 110], ["4004 đen", 40]]);
    expect(merged.operations[3].byOrder.map((x) => x.orderCode)).toEqual(["TÚI 4004 đỏ"]);
  });

  test("adds the planned quantities of the selected orders and labels the selection", () => {
    expect(merged.plannedQuantity).toBe(1700);
    expect(merged.orderCode).toBe("4004 xanh + 4004 đen + TÚI 4004 đỏ");
    expect(merged.orderIds).toEqual(["a", "b", "c"]);
  });

  test("merges contributors of the same person across orders, including daily totals", () => {
    const contributor = (hc, day) => ({ employeeCode: "E1", employeeName: "An", isExternal: false, hcQuantity: hc, tcQuantity: 0, totalQuantity: hc, dailyTotals: [{ workDate: day, hcQuantity: hc, tcQuantity: 0, totalQuantity: hc }] });
    const result = mergeOperationSummaries([
      summary("a", "A", [operation(1, "Cắt", [10, 0], { contributors: [contributor(10, "2026-09-11")] })]),
      summary("b", "B", [operation(1, "Cắt", [5, 0], { contributors: [contributor(5, "2026-09-11"), { ...contributor(2, "2026-09-12"), employeeCode: "E2", employeeName: "Bình" }] })]),
    ], []);

    const [an, binh] = result.operations[0].contributors;
    expect(an.employeeName).toBe("An");
    expect(an.totalQuantity).toBe(15);
    expect(an.dailyTotals).toEqual([{ workDate: "2026-09-11", hcQuantity: 15, tcQuantity: 0, totalQuantity: 15 }]);
    expect(binh.totalQuantity).toBe(2);
  });

  test("keeps different external sources apart even though they share the external code", () => {
    const external = (name, qty) => ({ employeeCode: "__EXTERNAL__", employeeName: name, isExternal: true, hcQuantity: 0, tcQuantity: 0, totalQuantity: qty, dailyTotals: [{ workDate: "2026-09-11", hcQuantity: 0, tcQuantity: 0, totalQuantity: qty }] });
    const result = mergeOperationSummaries([
      summary("a", "A", [operation(1, "Cắt", [0, 0], { contributors: [external("Hoàng Kim Nhung", 100), external("Xưởng B", 50)] })]),
      summary("b", "B", [operation(1, "Cắt", [0, 0], { contributors: [external("Hoàng Kim Nhung", 20), external("Xưởng C", 7)] })]),
    ], []);

    const contributors = result.operations[0].contributors;
    expect(contributors.map((x) => [x.employeeName, x.totalQuantity])).toEqual([["Hoàng Kim Nhung", 120], ["Xưởng B", 50], ["Xưởng C", 7]]);
  });

  test("keeps the order code on every daily row, one row per day and order", () => {
    const contributor = (hc, day) => ({ employeeCode: "E1", employeeName: "An", isExternal: false, hcQuantity: hc, tcQuantity: 0, totalQuantity: hc, dailyTotals: [{ workDate: day, hcQuantity: hc, tcQuantity: 0, totalQuantity: hc }] });
    const result = mergeOperationSummaries([
      summary("a", "A", [operation(1, "Cắt", [10, 0], { contributors: [contributor(10, "2026-09-11")] })]),
      summary("b", "B", [operation(1, "Cắt", [5, 0], { contributors: [contributor(5, "2026-09-11"), contributor(3, "2026-09-10")] })]),
    ], []);

    const [an] = result.operations[0].contributors;
    expect(an.dailyByOrder.map((x) => [x.workDate, x.orderCode, x.totalQuantity])).toEqual([
      ["2026-09-10", "B", 3],
      ["2026-09-11", "A", 10],
      ["2026-09-11", "B", 5],
    ]);
  });

  test("a single summary keeps its numbers and has a one-entry breakdown", () => {
    const single = mergeOperationSummaries([summary("a", "4004 xanh", [operation(1, "Cắt", [100, 10])])], orders);

    expect(single.operations[0].combinedTotalQuantity).toBe(110);
    expect(single.operations[0].byOrder).toHaveLength(1);
    expect(single.orderCode).toBe("4004 xanh");
    expect(single.plannedQuantity).toBe(1000);
  });

  test("no summaries gives an empty report", () => {
    expect(mergeOperationSummaries([], orders).operations).toEqual([]);
  });
});

describe("template names and units", () => {
  const two = [
    summary("a", "4004 xanh", [operation(2, "May", [10, 0])]),
    summary("b", "4004 đen", [operation(2, "May thân", [5, 0])]),
  ];

  test("uses the product template name when every order shares that product", () => {
    const template = { operations: [{ operationNumber: 2, name: "May thân chuẩn", isActive: true }] };
    const result = mergeOperationSummaries(two, [], template);

    expect(result.operations[0].name).toBe("May thân chuẩn");
    expect(result.operations[0].extraNames).toEqual([]);
  });

  test("falls back to the first name when the template lacks the operation", () => {
    expect(mergeOperationSummaries(two, [], { operations: [] }).operations[0].name).toBe("May");
  });

  test("flags operations whose unit differs between orders", () => {
    const result = mergeOperationSummaries([
      summary("a", "A", [operation(1, "Cắt", [1, 0])]),
      summary("b", "B", [{ ...operation(1, "Cắt", [1, 0]), unit: "đôi" }]),
    ]);

    expect(result.operations[0].unit).toBe("cái");
    expect(result.operations[0].extraUnits).toEqual(["đôi"]);
  });

  test("groups are labelled with the product name when known", () => {
    const groups = groupOrdersByProduct([{ id: "1", code: "4004 a", productCode: "4004" }], { 4004: "Túi 4004" });

    expect(groups[0].label).toBe("4004 · Túi 4004 (1 mã)");
  });
});

describe("order URL parameter", () => {
  test("parses one or many ids, trims, drops empties and duplicates", () => {
    expect(parseOrderParam("a")).toEqual(["a"]);
    expect(parseOrderParam(" a, b ,,a,c ")).toEqual(["a", "b", "c"]);
    expect(parseOrderParam("")).toEqual([]);
    expect(parseOrderParam(undefined)).toEqual([]);
  });

  test("limits the selection to the maximum", () => {
    const ids = Array.from({ length: 12 }, (_, index) => `o${index}`);

    expect(MAX_REPORT_ORDERS).toBe(8);
    expect(parseOrderParam(ids.join(","))).toHaveLength(8);
  });

  test("builds the comma separated parameter", () => {
    expect(buildOrderParam(["a", "b"])).toBe("a,b");
    expect(buildOrderParam([])).toBe("");
  });
});

describe("groupOrdersByProduct", () => {
  test("groups by product code with unassigned orders last", () => {
    const groups = groupOrdersByProduct([
      { id: "1", code: "0417", productCode: null },
      { id: "2", code: "4004 đen", productCode: "4004" },
      { id: "3", code: "4004 xanh", productCode: "4004" },
      { id: "4", code: "5005", productCode: "5005" },
    ]);

    expect(groups.map((x) => x.label)).toEqual(["4004 (2 mã)", "5005 (1 mã)", "Chưa gắn sản phẩm (1 mã)"]);
    expect(groups[0].orderIds).toEqual(["2", "3"]);
    expect(groups[2].key).toBe("");
  });
});

describe("selection toggling", () => {
  test("adds and removes a single order but never empties the selection or passes the maximum", () => {
    expect(toggleOrderSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleOrderSelection(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleOrderSelection(["a"], "a")).toEqual(["a"]);
    const full = Array.from({ length: MAX_REPORT_ORDERS }, (_, index) => `o${index}`);
    expect(toggleOrderSelection(full, "extra")).toEqual(full);
  });

  test("a group selects all its orders (up to the maximum) or removes them when all are selected", () => {
    expect(toggleGroupSelection(["x"], ["a", "b"])).toEqual(["x", "a", "b"]);
    expect(toggleGroupSelection(["x", "a", "b"], ["a", "b"])).toEqual(["x"]);
    expect(toggleGroupSelection(["a", "b"], ["a", "b"])).toEqual(["a", "b"]);
    const many = Array.from({ length: 10 }, (_, index) => `g${index}`);
    expect(toggleGroupSelection(["x"], many)).toHaveLength(MAX_REPORT_ORDERS);
    expect(toggleGroupSelection(["x"], many)[0]).toBe("x");
  });
});
