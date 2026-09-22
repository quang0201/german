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

  test("reuses a short-lived cached lookup and deduplicates concurrent requests", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      await Promise.resolve();
      return { status: 200, ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ calls }) };
    };

    api.clearCache();
    try {
      const [first, second] = await Promise.all([
        api.getCached("/api/lookups/production-orders/active", 10_000),
        api.getCached("/api/lookups/production-orders/active", 10_000),
      ]);
      const third = await api.getCached("/api/lookups/production-orders/active", 10_000);

      expect(calls).toBe(1);
      expect(first).toEqual(second);
      expect(third).toEqual(first);
    } finally {
      api.clearCache();
      globalThis.fetch = originalFetch;
    }
  });

  test("invalidates cached lookups by prefix", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { status: 200, ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => calls };
    };

    api.clearCache();
    try {
      await api.getCached("/api/production-orders/one/operations", 10_000);
      api.invalidateCache("/api/production-orders/one");
      await api.getCached("/api/production-orders/one/operations", 10_000);

      expect(calls).toBe(2);
    } finally {
      api.clearCache();
      globalThis.fetch = originalFetch;
    }
  });

  test("does not repopulate an invalidated lookup with an older in-flight response", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    let resolveFirst;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return new Promise((resolve) => { resolveFirst = resolve; });
      return { status: 200, ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => "fresh" };
    };

    api.clearCache();
    try {
      const oldRequest = api.getCached("/api/production-orders/order/operations", 10_000);
      api.invalidateCache("/api/production-orders/order");
      const freshRequest = api.getCached("/api/production-orders/order/operations", 10_000);
      resolveFirst({ status: 200, ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => "stale" });

      await oldRequest;
      expect(await freshRequest).toBe("fresh");
      expect(await api.getCached("/api/production-orders/order/operations", 10_000)).toBe("fresh");
      expect(calls).toBe(2);
    } finally {
      api.clearCache();
      globalThis.fetch = originalFetch;
    }
  });
});
