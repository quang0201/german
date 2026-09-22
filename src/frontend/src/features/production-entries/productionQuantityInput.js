export function sanitizeProductionQuantityInput(value) {
  return String(value ?? "").replace(/[^\d.+-]/gu, "");
}
