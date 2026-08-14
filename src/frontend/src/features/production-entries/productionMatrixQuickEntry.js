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

export function canWriteQuickEntry({ editing, detailLoaded, saving, conflict = false }) {
  return !saving && !conflict && (!editing || detailLoaded);
}

export function shouldShowQuickEntryReload({ editing, loadingEntry, detailLoaded, conflict }) {
  return !loadingEntry && (conflict || (editing && !detailLoaded));
}

export function quickEntryFeedbackMessage({ error = "", conflictError = "" }) {
  return error || conflictError || "";
}

export function buildQuickEntryCreatePayload(payload) {
  return { ...payload, expectedEmpty: true };
}

export function buildQuickEntryPayload({ context, quantities, editEntry, note }) {
  return {
    workDate: context.workDate,
    employeeId: context.employee.employeeId,
    productionOrderId: context.order.orderId,
    productionOperationId: context.operation.operationId,
    entryMode: "Direct",
    shift1Quantity: null,
    shift2Quantity: null,
    directHcQuantity: quantities.hc,
    directTcQuantity: quantities.tc,
    totalInputQuantity: null,
    overtimeHours: null,
    overtimeQuantity: null,
    workStart: editEntry?.workStart ?? null,
    workEnd: editEntry?.workEnd ?? null,
    note: note.trim() || null,
  };
}

export function createQuickEntry(payload) {
  return api.post("/api/production-entries", buildQuickEntryCreatePayload(payload));
}
import { api } from "../../lib/api.js";
