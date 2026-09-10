import { join } from "node:path";

export interface GermanMcpConfig {
  api: {
    baseUrl: string;
    username?: string;
    password?: string;
    mcpToken?: string;
    sessionCookie?: string;
    timeoutMs: number;
  };
  logDirectory: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): GermanMcpConfig {
  const baseUrl = env.GERMAN_API_BASE_URL || "https://hr.quangt.com";
  const parsed = new URL(baseUrl);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("GERMAN_API_BASE_URL must use HTTP or HTTPS.");
  if ((env.GERMAN_API_USERNAME && !env.GERMAN_API_PASSWORD) || (!env.GERMAN_API_USERNAME && env.GERMAN_API_PASSWORD)) {
    throw new Error("GERMAN_API_USERNAME and GERMAN_API_PASSWORD must be configured together.");
  }

  return {
    api: {
      baseUrl: parsed.toString().replace(/\/+$/, ""),
      username: env.GERMAN_API_USERNAME,
      password: env.GERMAN_API_PASSWORD,
      mcpToken: env.GERMAN_API_MCP_TOKEN,
      sessionCookie: env.GERMAN_API_SESSION_COOKIE,
      timeoutMs: Number(env.GERMAN_API_TIMEOUT_MS || 15_000),
    },
    logDirectory: env.GERMAN_MCP_LOG_DIR || join(process.cwd(), ".mcp-logs"),
  };
}
