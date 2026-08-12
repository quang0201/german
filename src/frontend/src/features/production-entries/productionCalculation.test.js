import { describe, expect, test } from "bun:test";
import { calculatePreview } from "./productionCalculation.js";

describe("calculatePreview", () => {
  test("ByShift without overtime keeps all output as HC", () => {
    expect(calculatePreview({
      mode: "ByShift",
      hcHours: 9,
      shift1Quantity: 280,
      shift2Quantity: 120,
    })).toEqual({ hc: 400, tc: 0, total: 400 });
  });

  test("ByShift splits the shift total using configured HC hours", () => {
    expect(calculatePreview({
      mode: "ByShift",
      hcHours: 9,
      shift1Quantity: 310,
      shift2Quantity: 120,
      overtimeHours: 2,
    })).toEqual({ hc: 352, tc: 78, total: 430 });
  });

  test("ByShift treats actual overtime quantity as part of the shift total", () => {
    expect(calculatePreview({
      mode: "ByShift",
      hcHours: 9,
      shift1Quantity: 310,
      shift2Quantity: 120,
      overtimeHours: 2,
      overtimeQuantity: 108,
    })).toEqual({ hc: 322, tc: 108, total: 430 });
  });

  test("ByShift rejects actual overtime greater than total", () => {
    expect(() => calculatePreview({
      mode: "ByShift",
      hcHours: 9,
      shift1Quantity: 50,
      shift2Quantity: 50,
      overtimeQuantity: 101,
    })).toThrow();
  });

  test("Direct preserves manually entered HC and TC", () => {
    expect(calculatePreview({
      mode: "Direct",
      directHcQuantity: 535,
      directTcQuantity: 135,
    })).toEqual({ hc: 535, tc: 135, total: 670 });
  });

  test("TotalWithOvertime splits the total", () => {
    expect(calculatePreview({
      mode: "TotalWithOvertime",
      hcHours: 8,
      totalQuantity: 620,
      overtimeHours: 1.5,
    })).toEqual({ hc: 522, tc: 98, total: 620 });
  });
});
