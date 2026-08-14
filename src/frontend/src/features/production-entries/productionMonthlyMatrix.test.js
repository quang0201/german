import { describe, expect, test } from "bun:test";
import {
  buildProductionMonthlyMatrixUrl,
  currentMonthKey,
  matrixCellAction,
  monthBounds,
  monthDateAxis,
  monthLabel,
  shiftMonth,
} from "./productionMonthlyMatrix.js";

describe("production monthly matrix helpers", () => {
  test("derives and shifts months across year boundaries", () => {
    expect(currentMonthKey("2026-08-14")).toBe("2026-08");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-08")).toBe("08/2026");
  });

  test("derives leap-February bounds and weekday-labelled date axis", () => {
    expect(monthBounds("2028-02")).toEqual({ fromDate: "2028-02-01", untilDate: "2028-02-29" });
    const axis = monthDateAxis("2028-02", false);
    expect(axis).toHaveLength(29);
    expect(axis[0]).toEqual({ isoDate: "2028-02-01", weekdayLabel: "T3", displayDate: "01/02", isSunday: false });
    expect(axis.at(-1)?.isoDate).toBe("2028-02-29");
  });

  test("excludes Sundays only when requested", () => {
    const fullAxis = monthDateAxis("2026-08", false);
    const workingAxis = monthDateAxis("2026-08", true);
    expect(fullAxis.some((day) => day.isSunday)).toBe(true);
    expect(workingAxis.some((day) => day.isSunday)).toBe(false);
    expect(workingAxis.length).toBeLessThan(fullAxis.length);
  });

  test("serializes filters and defaults Sunday exclusion to true", () => {
    const url = buildProductionMonthlyMatrixUrl({
      monthKey: "2026-08",
      employeeId: "employee-1",
      orderId: "order-1",
      operationId: "operation-1",
      search: "Quỳnh & CĐ4",
    });
    const parsed = new URL(url, "http://local.test");
    expect(parsed.pathname).toBe("/api/production-entries/monthly-matrix");
    expect(parsed.searchParams.get("year")).toBe("2026");
    expect(parsed.searchParams.get("month")).toBe("8");
    expect(parsed.searchParams.get("employeeId")).toBe("employee-1");
    expect(parsed.searchParams.get("orderId")).toBe("order-1");
    expect(parsed.searchParams.get("operationId")).toBe("operation-1");
    expect(parsed.searchParams.get("search")).toBe("Quỳnh & CĐ4");
    expect(parsed.searchParams.get("excludeSundays")).toBe("true");

    const sundayUrl = new URL(buildProductionMonthlyMatrixUrl({ monthKey: "2026-08", excludeSundays: false }), "http://local.test");
    expect(sundayUrl.searchParams.get("excludeSundays")).toBe("false");
  });

  test("selects safe interaction for empty, single and multi-record cells", () => {
    expect(matrixCellAction(null)).toBe("create");
    expect(matrixCellAction({ entryCount: 0, records: [] })).toBe("create");
    expect(matrixCellAction({ entryCount: 1, records: [{ entryMode: "Direct" }] })).toBe("edit-direct");
    expect(matrixCellAction({ entryCount: 1, records: [{ entryMode: "ByShift" }] })).toBe("open-entry");
    expect(matrixCellAction({ entryCount: 2, records: [{ entryMode: "Direct" }, { entryMode: "ByShift" }] })).toBe("choose-record");
  });
});
