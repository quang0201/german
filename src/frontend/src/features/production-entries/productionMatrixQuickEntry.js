function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export function isQuickEntryDetailCompatible({ record, context, detail }) {
  return Boolean(
    record && context && detail
      && sameId(detail.id, record.id)
      && detail.version === record.version
      && detail.entryMode === "Direct"
      && detail.workDate === context.workDate
      && sameId(detail.employeeId, context.employee.employeeId)
      && sameId(detail.productionOrderId, context.order.orderId)
      && sameId(detail.productionOperationId, context.operation.operationId),
  );
}

export function quickEntryExpectedVersion(record) {
  return record?.version;
}

export function canWriteQuickEntry({ editing, detailLoaded, saving }) {
  return !saving && (!editing || detailLoaded);
}
