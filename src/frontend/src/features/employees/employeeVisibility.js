export function employeeVisibleForMonth(employee, monthKey) {
  if (employee?.isActive !== false) return true;
  const deactivatedMonth = String(employee?.deactivatedAt ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(String(monthKey ?? "")) || !/^\d{4}-\d{2}$/.test(deactivatedMonth)) return false;
  return deactivatedMonth >= monthKey;
}
