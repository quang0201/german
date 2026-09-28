import { describe, expect, test } from "bun:test";
import { mobileFilterPanelReducer } from "./productionFilterPanel.js";

describe("mobile production filter panel", () => {
  test("toggle opens and closes the panel", () => {
    expect(mobileFilterPanelReducer(false, "toggle")).toBe(true);
    expect(mobileFilterPanelReducer(true, "toggle")).toBe(false);
  });

  test("close, apply and reset always return to the closed state", () => {
    for (const action of ["close", "apply", "reset"]) {
      expect(mobileFilterPanelReducer(true, action)).toBe(false);
    }
  });

  test("ignores unknown actions without changing panel state", () => {
    expect(mobileFilterPanelReducer(true, "unknown")).toBe(true);
    expect(mobileFilterPanelReducer(false, "unknown")).toBe(false);
  });
});
