import { describe, expect, test } from "bun:test";
import { createNavigationState, resolvePresentation } from "./navigation.js";

describe("ERP navigation state", () => {
  test("stores panel presentation and background route", () => {
    const state = createNavigationState({ presentation: "panel", backgroundRoute: "/production" });
    expect(state).toEqual({ presentation: "panel", backgroundRoute: "/production", backgroundSearch: "" });
    expect(resolvePresentation("/production/entry-1", state)).toBe("panel");
  });

  test("remembers the background query string so closing a panel restores the filters", () => {
    const previous = globalThis.window;
    globalThis.window = { location: { search: "?order=o1&q=Lan" } };
    try {
      const state = createNavigationState({ presentation: "panel", backgroundRoute: "/production" });
      expect(state.backgroundSearch).toBe("?order=o1&q=Lan");
    } finally {
      globalThis.window = previous;
    }
  });

  test("treats direct detail load without history state as standalone", () => {
    expect(resolvePresentation("/production/entry-1", null)).toBe("page");
  });
});
