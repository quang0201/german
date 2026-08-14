export function isCurrentBatchOperationsRequest(active, requestedOrderId, currentOrderId) {
  return active && String(requestedOrderId ?? "") === String(currentOrderId ?? "");
}

export function isCurrentBatchOrdersRequest(active, requestedDay, currentDay) {
  return active
    && requestedDay?.isoDate === currentDay?.isoDate
    && String(requestedDay?.preferredOrderId ?? "") === String(currentDay?.preferredOrderId ?? "");
}
