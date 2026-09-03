import { describe, expect, test } from "bun:test";
import { toApiTime } from "./time.js";

describe("toApiTime", () => {
  test("adds seconds to browser time input", () => {
    expect(toApiTime("07:00")).toBe("07:00:00");
  });

  test("preserves values that already contain seconds", () => {
    expect(toApiTime("17:30:00")).toBe("17:30:00");
  });

  test("maps empty input to null", () => {
    expect(toApiTime("")).toBeNull();
    expect(toApiTime(null)).toBeNull();
  });
});
