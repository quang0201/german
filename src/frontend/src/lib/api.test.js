import { describe, expect, test } from "bun:test";
import { api } from "./api.js";

describe("api.download", () => {
  test("bypasses browser caches for generated files", async () => {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    const originalUrl = globalThis.URL;
    let requestOptions;
    const link = { click() {} };

    globalThis.fetch = async (_path, options) => {
      requestOptions = options;
      return { ok: true, blob: async () => new Blob(["xlsx"]) };
    };
    globalThis.document = { createElement: () => link };
    globalThis.URL = {
      createObjectURL: () => "blob:test",
      revokeObjectURL() {},
    };

    try {
      await api.download("/api/reports/export.xlsx", "report.xlsx");
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.document = originalDocument;
      globalThis.URL = originalUrl;
    }

    expect(requestOptions).toEqual({ credentials: "include", cache: "no-store" });
  });
});

describe("api.get", () => {
  test("bypasses browser caches for backend data", async () => {
    const originalFetch = globalThis.fetch;
    let requestOptions;

    globalThis.fetch = async (_path, options) => {
      requestOptions = options;
      return { status: 200, ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({}) };
    };

    try {
      await api.get("/api/attendance/monthly?year=2026&month=8");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requestOptions.cache).toBe("no-store");
  });
});
