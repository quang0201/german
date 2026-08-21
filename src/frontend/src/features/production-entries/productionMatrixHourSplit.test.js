import { describe, expect, test } from "bun:test";
import {
  calculateHourSplitPreview,
  calculateMultiShiftHourSplit,
  parseProductionExpression,
  resolveQuickEntryQuantities,
} from "./productionMatrixHourSplit.js";

describe("production matrix hour split", () => {
  test("parses addition-only production expressions", () => {
    expect(parseProductionExpression("300")).toEqual({ terms: [300], total: 300 });
    expect(parseProductionExpression("300 + 100 + 50.5")).toEqual({ terms: [300, 100, 50.5], total: 450.5 });
  });

  test("rejects unsupported operators, empty terms, grouping, and invalid numbers", () => {
    for (const expression of ["", "300-100", "300*2", "300/2", "(300+100)", "300+", "+300", "300,,100", "1,000", "abc", "-10", "Infinity"]) {
      expect(() => parseProductionExpression(expression)).toThrow();
    }
  });

  test("splits 400 production across 8 HC hours and 2 TC hours", () => {
    expect(calculateHourSplitPreview({ hcHours: "8", tcHours: "2", totalExpression: "300+100" })).toEqual({
      total: 400,
      totalHours: 10,
      quantityPerHour: 40,
      hc: 320,
      tc: 80,
    });
  });

  test("assigns all production to the non-zero hour bucket", () => {
    expect(calculateHourSplitPreview({ hcHours: "8", tcHours: "0", totalExpression: "100" })).toMatchObject({ hc: 100, tc: 0 });
    expect(calculateHourSplitPreview({ hcHours: "0", tcHours: "2", totalExpression: "100" })).toMatchObject({ hc: 0, tc: 100 });
  });

  test("keeps decimal production non-negative when one hour bucket is zero", () => {
    expect(calculateHourSplitPreview({ hcHours: "8", tcHours: "0", totalExpression: "0.4" })).toMatchObject({ hc: 0.4, tc: 0 });
    expect(calculateHourSplitPreview({ hcHours: "8", tcHours: "0", totalExpression: "0.6" })).toMatchObject({ hc: 0.6, tc: 0 });
    expect(calculateHourSplitPreview({ hcHours: "9", tcHours: "1", totalExpression: "0.6" })).toMatchObject({ hc: 0.6, tc: 0 });
  });

  test("rejects zero total hours and invalid hour values", () => {
    expect(() => calculateHourSplitPreview({ hcHours: "0", tcHours: "0", totalExpression: "100" })).toThrow();
    expect(() => calculateHourSplitPreview({ hcHours: "", tcHours: "2", totalExpression: "100" })).toThrow();
    expect(() => calculateHourSplitPreview({ hcHours: "-1", tcHours: "2", totalExpression: "100" })).toThrow();
  });

  test("rounds HC and preserves the parsed total exactly", () => {
    const preview = calculateHourSplitPreview({ hcHours: "1", tcHours: "2", totalExpression: "10" });
    expect(preview.hc + preview.tc).toBe(preview.total);
    expect(preview).toMatchObject({ hc: 3, tc: 7 });
  });

  test("keeps Direct and hour-split quantity drafts independent", () => {
    expect(resolveQuickEntryQuantities({ mode: "direct", directHcQuantity: "12", directTcQuantity: "3", hcHours: "8", tcHours: "2", totalExpression: "100" }))
      .toEqual({ hc: 12, tc: 3 });
    expect(resolveQuickEntryQuantities({ mode: "hour-split", directHcQuantity: "12", directTcQuantity: "3", hcHours: "8", tcHours: "2", totalExpression: "100" }))
      .toEqual({ hc: 80, tc: 20 });
  });

  test("splits production across dynamic attendance shifts and overtime", () => {
    const preview = calculateMultiShiftHourSplit({
      shifts: [
        { slotNumber: 1, shiftName: "Ca 1", workedHours: "4" },
        { slotNumber: 2, shiftName: "Ca 2", workedHours: "4" },
      ],
      overtimeHours: "2",
      totalExpression: "1000",
    });

    expect(preview.shifts.map((item) => item.quantity)).toEqual([400, 400]);
    expect(preview.hc).toBe(800);
    expect(preview.tc).toBe(200);
    expect(preview.hc + preview.tc).toBe(preview.total);
  });

  test("supports three dynamic shifts and zero overtime", () => {
    const preview = calculateMultiShiftHourSplit({
      shifts: [
        { slotNumber: 1, shiftName: "Sáng", workedHours: "2" },
        { slotNumber: 2, shiftName: "Chiều", workedHours: "3" },
        { slotNumber: 3, shiftName: "Tối", workedHours: "5" },
      ],
      overtimeHours: "0",
      totalExpression: "101",
    });

    expect(preview.shifts.map((item) => item.quantity)).toEqual([20, 30, 51]);
    expect(preview.tc).toBe(0);
    expect(preview.hc + preview.tc).toBe(101);
  });

  test("preserves decimal totals and non-negative allocations", () => {
    const preview = calculateMultiShiftHourSplit({
      shifts: [
        { slotNumber: 1, shiftName: "Ca 1", workedHours: "4" },
        { slotNumber: 2, shiftName: "Ca 2", workedHours: "4" },
      ],
      overtimeHours: "2",
      totalExpression: "0.6",
    });

    expect(preview.shifts.every((item) => item.quantity >= 0)).toBe(true);
    expect(preview.tc).toBeGreaterThanOrEqual(0);
    expect(preview.hc + preview.tc).toBe(0.6);
  });
});
