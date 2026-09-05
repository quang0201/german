export const PRODUCTION_PLAN_VARIANCE_TOLERANCE = 100;

function positiveNumber(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function productionPlanLimit(plannedQuantity, tolerance = PRODUCTION_PLAN_VARIANCE_TOLERANCE) {
  const planned = positiveNumber(plannedQuantity);
  const allowedVariance = Number(tolerance);
  if (planned === null || !Number.isFinite(allowedVariance) || allowedVariance < 0) return null;
  return planned + allowedVariance;
}

export function isOverProductionPlan(actualQuantity, plannedQuantity, tolerance = PRODUCTION_PLAN_VARIANCE_TOLERANCE) {
  const limit = productionPlanLimit(plannedQuantity, tolerance);
  const actual = Number(actualQuantity);
  return limit !== null && Number.isFinite(actual) && actual > limit;
}
