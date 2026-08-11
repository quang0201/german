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

  test("ByShift uses configured HC hours for overtime preview", () => {
    expect(calculatePreview({
      mode: "ByShift",
      hcHours: 9,
      shift1Quantity: 310,
      shift2Quantity: 120,
      overtimeHours: 2,
    })).toEqual({ hc: 430, tc: 96, total: 526 });
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
