import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLogger } from "./auditLogger.ts";

let directory = "";

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

describe("MCP audit logger", () => {
  test("writes JSONL audit events and redacts sensitive fields", async () => {
    directory = await mkdtemp(join(tmpdir(), "german-mcp-log-"));
    const logger = new AuditLogger(directory, () => new Date("2026-09-10T10:20:30.000Z"));

    await logger.record({
      tool: "german_create_external_quantity",
      ok: true,
      input: { orderCode: "4004 xanh", password: "secret", token: "hidden", quantity: 3443 },
      response: { cookie: "session-cookie", status: 201 },
    });

    const file = await readFile(join(directory, "audit-2026-09-10.jsonl"), "utf8");
    const event = JSON.parse(file.trim());
    expect(event.tool).toBe("german_create_external_quantity");
    expect(event.input.quantity).toBe(3443);
    expect(JSON.stringify(event)).not.toContain("secret");
    expect(JSON.stringify(event)).not.toContain("hidden");
    expect(JSON.stringify(event)).not.toContain("session-cookie");
  });
});
