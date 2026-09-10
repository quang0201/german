import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const SENSITIVE_KEY = /(password|passphrase|token|secret|cookie|authorization|credential|session)/i;

function sanitize(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

export class AuditLogger {
  constructor(private readonly directory: string, private readonly clock: () => Date = () => new Date()) {}

  async record(event: Record<string, unknown>): Promise<void> {
    const timestamp = this.clock().toISOString();
    const line = JSON.stringify({ timestamp, ...sanitize(event) }) + "\n";
    await mkdir(this.directory, { recursive: true });
    await appendFile(join(this.directory, `audit-${timestamp.slice(0, 10)}.jsonl`), line, "utf8");
  }
}
