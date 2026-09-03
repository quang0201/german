import { describe, expect, test } from "bun:test";
import {
  derivePeriodRange,
  formatDisplayDate,
  formatPeriodLabel,
  localIsoDate,
  shiftPeriod,
} from "./productionPeriod.js";

describe("production period helpers", () => {
  test("formats local dates without shifting the calendar day", () => {
    const date = new Date(2024, 0, 5, 23, 30);

    expect(localIsoDate(date)).toBe("2024-01-05");
    expect(formatDisplayDate("2024-01-05")).toBe("05/01/2024");
  });

  test("supports yesterday as a day-period shortcut", () => {
    expect(derivePeriodRange({
      periodMode: "day",
      anchorDate: "2024-02-28",
    })).toEqual({ fromDate: "2024-02-28", untilDate: "2024-02-28" });
  });

  test("derives Monday through Sunday across a year boundary", () => {
    expect(derivePeriodRange({
      periodMode: "week",
      anchorDate: "2023-01-01",
    })).toEqual({ fromDate: "2022-12-26", untilDate: "2023-01-01" });
  });

  test("derives the leap-day month range", () => {
    expect(derivePeriodRange({
      periodMode: "month",
      anchorDate: "2024-02-15",
    })).toEqual({ fromDate: "2024-02-01", untilDate: "2024-02-29" });
  });

  test("shifts day, week, and month periods with local calendar arithmetic", () => {
    expect(shiftPeriod("day", "2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftPeriod("week", "2024-01-01", 1)).toBe("2024-01-08");
    expect(shiftPeriod("month", "2024-01-31", 1)).toBe("2024-02-29");
    expect(shiftPeriod("month", "2024-03-31", -1)).toBe("2024-02-29");
  });

  test("passes custom dates through unchanged", () => {
    expect(derivePeriodRange({
      periodMode: "custom",
      anchorDate: "2024-02-15",
      customFromDate: "2024-01-30",
      customUntilDate: "2024-02-02",
    })).toEqual({ fromDate: "2024-01-30", untilDate: "2024-02-02" });
  });

  test("formats labels for each period mode", () => {
    expect(formatPeriodLabel({ periodMode: "day", anchorDate: "2024-03-05" })).toBe("05/03/2024");
    expect(formatPeriodLabel({ periodMode: "week", anchorDate: "2024-03-05" })).toBe("04/03/2024 – 10/03/2024");
    expect(formatPeriodLabel({ periodMode: "month", anchorDate: "2024-03-05" })).toBe("03/2024");
    expect(formatPeriodLabel({
      periodMode: "custom",
      anchorDate: "2024-03-05",
      customFromDate: "2024-03-01",
      customUntilDate: "2024-03-05",
    })).toBe("01/03/2024 – 05/03/2024");
  });
});
