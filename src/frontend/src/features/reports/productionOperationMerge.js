export const MAX_REPORT_ORDERS = 8;

export function parseOrderParam(text) {
  const ids = [...new Set(String(text ?? "").split(",").map((part) => part.trim()).filter(Boolean))];
  return ids.slice(0, MAX_REPORT_ORDERS);
}

export function buildOrderParam(ids) {
  return (ids ?? []).join(",");
}

/** Orders grouped by product for the picker; orders without a product go last under key "". */
export function groupOrdersByProduct(orders, productNames = {}) {
  const groups = new Map();
  for (const order of orders ?? []) {
    const key = order.productCode ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "vi", { numeric: true })))
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => String(a.code).localeCompare(String(b.code), "vi", { numeric: true }));
      return { key, label: `${key ? (productNames[key] ? `${key} · ${productNames[key]}` : key) : "Chưa gắn sản phẩm"} (${sorted.length} mã)`, orderIds: sorted.map((order) => order.id), orders: sorted };
    });
}

const num = (value) => Number(value || 0);

function mergeContributors(lists) {
  const merged = new Map();
  for (const item of lists.flat()) {
    const key = `${item.isExternal ? "x" : "e"}:${item.employeeCode || item.employeeName}`;
    const target = merged.get(key);
    if (!target) {
      merged.set(key, { ...item, dailyTotals: mergeDaily(item.dailyTotals ?? []) });
      continue;
    }

    target.hcQuantity = num(target.hcQuantity) + num(item.hcQuantity);
    target.tcQuantity = num(target.tcQuantity) + num(item.tcQuantity);
    target.totalQuantity = num(target.totalQuantity) + num(item.totalQuantity);
    target.dailyTotals = mergeDaily([...target.dailyTotals, ...(item.dailyTotals ?? [])]);
  }
  return [...merged.values()];
}

function mergeDaily(days) {
  const byDate = new Map();
  for (const day of days) {
    const current = byDate.get(day.workDate) ?? { workDate: day.workDate, hcQuantity: 0, tcQuantity: 0, totalQuantity: 0 };
    current.hcQuantity += num(day.hcQuantity);
    current.tcQuantity += num(day.tcQuantity);
    current.totalQuantity += num(day.totalQuantity);
    byDate.set(day.workDate, current);
  }
  return [...byDate.values()].sort((a, b) => String(a.workDate).localeCompare(String(b.workDate)));
}

/**
 * Sums the per-order operation summaries by operation number. The result has the shape of a single summary
 * (so the existing chart renders it) plus per-operation `byOrder` and `extraNames`.
 */
export function mergeOperationSummaries(summaries, orders = [], template = null) {
  const list = summaries ?? [];
  const byNumber = new Map();

  for (const summary of list) {
    for (const operation of summary.operations ?? []) {
      let row = byNumber.get(operation.operationNumber);
      if (!row) {
        row = {
          operationId: operation.operationId ?? String(operation.operationNumber),
          operationNumber: operation.operationNumber,
          name: operation.name,
          extraNames: [],
          unit: operation.unit,
          extraUnits: [],
          hcQuantity: 0,
          tcQuantity: 0,
          totalQuantity: 0,
          externalQuantity: 0,
          combinedTotalQuantity: 0,
          byOrder: [],
          contributorLists: [],
        };
        byNumber.set(operation.operationNumber, row);
      }

      if (operation.name !== row.name && !row.extraNames.includes(operation.name)) row.extraNames.push(operation.name);
      if (operation.unit !== row.unit && !row.extraUnits.includes(operation.unit)) row.extraUnits.push(operation.unit);
      const internal = num(operation.totalQuantity);
      const external = num(operation.externalQuantity);
      const combined = num(operation.combinedTotalQuantity ?? internal + external);
      row.hcQuantity += num(operation.hcQuantity);
      row.tcQuantity += num(operation.tcQuantity);
      row.totalQuantity += internal;
      row.externalQuantity += external;
      row.combinedTotalQuantity += combined;
      row.contributorLists.push(operation.contributors ?? []);
      row.byOrder.push({
        orderId: summary.orderId,
        orderCode: summary.orderCode,
        hcQuantity: num(operation.hcQuantity),
        tcQuantity: num(operation.tcQuantity),
        totalQuantity: internal,
        externalQuantity: external,
        combinedTotalQuantity: combined,
      });
    }
  }

  const operations = [...byNumber.values()]
    .sort((a, b) => a.operationNumber - b.operationNumber)
    .map(({ contributorLists, ...row }) => {
      const templateName = (template?.operations ?? []).find((item) => item.operationNumber === row.operationNumber && item.isActive !== false)?.name;
      return {
        ...row,
        ...(templateName ? { name: templateName, extraNames: [] } : {}),
        contributors: mergeContributors(contributorLists),
      };
    });

  const orderIds = list.map((summary) => summary.orderId);
  const plannedQuantity = orderIds.reduce((sum, id) => sum + num(orders.find((order) => String(order.id) === String(id))?.plannedQuantity), 0);

  return {
    orderIds,
    orderCode: list.map((summary) => summary.orderCode).join(" + "),
    productName: list.length === 1 ? list[0].productName : `${list.length} mã sản xuất`,
    operationCount: operations.length,
    operations,
    plannedQuantity,
  };
}

export function toggleOrderSelection(selected, id) {
  if (selected.includes(id)) return selected.length > 1 ? selected.filter((item) => item !== id) : selected;
  return selected.length >= MAX_REPORT_ORDERS ? selected : [...selected, id];
}

export function toggleGroupSelection(selected, groupIds) {
  const allSelected = groupIds.every((id) => selected.includes(id));
  if (allSelected) {
    const rest = selected.filter((id) => !groupIds.includes(id));
    return rest.length > 0 ? rest : selected;
  }
  return [...selected, ...groupIds.filter((id) => !selected.includes(id))].slice(0, MAX_REPORT_ORDERS);
}
