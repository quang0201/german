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
