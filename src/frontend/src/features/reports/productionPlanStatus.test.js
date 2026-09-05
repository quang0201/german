import { describe, expect, test } from "bun:test";
import { isOverProductionPlan, productionPlanLimit } from "./productionPlanStatus.js";

describe("production plan status", () => {
  test("allows a variance of exactly 100 units", () => {
    expect(productionPlanLimit(15000)).toBe(15100);
    expect(isOverProductionPlan(15100, 15000)).toBe(false);
  });

  test("marks 15101 as over a 15000 plan", () => {
    expect(isOverProductionPlan(15101, 15000)).toBe(true);
  });

  test("does not warn when there is no positive production plan", () => {
    expect(isOverProductionPlan(15101, 0)).toBe(false);
    expect(isOverProductionPlan(15101, undefined)).toBe(false);
  });
});
