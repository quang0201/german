import { describe, expect, test } from "bun:test";
import { createNavigationState, resolvePresentation } from "./navigation.js";

describe("ERP navigation state", () => {
  test("stores panel presentation and background route", () => {
    const state = createNavigationState({ presentation: "panel", backgroundRoute: "/production" });
    expect(state).toEqual({ presentation: "panel", backgroundRoute: "/production" });
    expect(resolvePresentation("/production/entry-1", state)).toBe("panel");
  });

  test("treats direct detail load without history state as standalone", () => {
    expect(resolvePresentation("/production/entry-1", null)).toBe("page");
  });
});
