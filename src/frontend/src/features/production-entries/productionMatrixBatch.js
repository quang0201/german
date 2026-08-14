export function isCurrentBatchOperationsRequest(active, requestedOrderId, currentOrderId) {
  return active && String(requestedOrderId ?? "") === String(currentOrderId ?? "");
}
