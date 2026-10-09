import { describe, expect, test } from "bun:test";
import { buildSearch, queryChoice, queryDate, queryInteger, queryMonth, readQuery } from "./queryState.js";

describe("queryState", () => {
  test("reads managed keys and defaults missing ones to an empty string", () => {
    expect(readQuery(["order", "q", "employee"], "?order=abc&q=Lan%20Anh")).toEqual({ order: "abc", q: "Lan Anh", employee: "" });
  });

  test("validates dates, months, choices and integers instead of trusting the URL", () => {
    expect(queryDate("2026-10-08", "x")).toBe("2026-10-08");
    expect(queryDate("2026-13-45", "x")).toBe("x");
    expect(queryDate("hello", "x")).toBe("x");
    expect(queryMonth("2026-10", "x")).toBe("2026-10");
    expect(queryMonth("2026-13", "x")).toBe("x");
    expect(queryChoice("week", ["day", "week"], "day")).toBe("week");
    expect(queryChoice("year", ["day", "week"], "day")).toBe("day");
    expect(queryInteger("7", { min: 1, max: 12, fallback: 1 })).toBe(7);
    expect(queryInteger("99", { min: 1, max: 12, fallback: 1 })).toBe(1);
    expect(queryInteger("", { min: 1, max: 12, fallback: 1 })).toBe(1);
  });

  test("drops empty and default values and keeps unrelated params", () => {
    expect(buildSearch("tab=keep&q=old", { q: "", order: "o1", employee: "" })).toBe("tab=keep&order=o1");
    expect(buildSearch("", { month: "2026-10" }, { month: "2026-10" })).toBe("");
    expect(buildSearch("", { q: "Lan Anh" })).toBe("q=Lan+Anh");
  });
});
