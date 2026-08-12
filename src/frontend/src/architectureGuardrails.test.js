import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const sourceRoot = resolve(import.meta.dir);
function files(relative) { return readdirSync(resolve(sourceRoot, relative), { withFileTypes: true }).filter((entry) => entry.isFile() && /\.(js|jsx)$/.test(entry.name)).map((entry) => resolve(sourceRoot, relative, entry.name)); }
function read(path) { return readFileSync(path, "utf8"); }

describe("ERP frontend guardrails", () => {
  test("user feedback never uses browser dialogs", () => {
    const all = [...files("app"), ...files("components/erp"), ...files("features")].map(read).join("\n");
    expect(all).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
  });
  test("shared ERP components do not import feature internals", () => {
    expect(files("components/erp").some((path) => read(path).includes("features/"))).toBe(false);
  });
  test("routes have the required navigation metadata", async () => {
    const { routes } = await import("./app/routes.js");
    expect(routes.every((route) => route.path && route.component && route.breadcrumb && route.roles?.length)).toBe(true);
  });
});
