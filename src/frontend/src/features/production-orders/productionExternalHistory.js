function sourceKey(entry) {
  return entry.externalSourceId || `name:${String(entry.sourceName || "").trim().toLocaleUpperCase("vi-VN")}`;
}

export function groupProductionExternalHistory(entries = [], operations = []) {
  const operationById = new Map(operations.map((operation) => [operation.id, operation]));
  const groups = new Map();

  for (const entry of entries) {
    const key = sourceKey(entry);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        sourceName: entry.sourceName || "Không ghi nguồn",
        entries: [],
      });
    }

    groups.get(key).entries.push({
      ...entry,
      operation: operationById.get(entry.productionOperationId) || null,
    });
  }

  return [...groups.values()];
}
