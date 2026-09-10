export interface GermanApiConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  sessionCookie?: string;
  timeoutMs?: number;
}

type FetchLike = typeof fetch;

function cookieValue(headers: Headers): string | null {
  const extendedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const raw = extendedHeaders.getSetCookie?.()[0] || headers.get("set-cookie") || "";
  const match = raw.match(/german\.auth=[^;]+/);
  return match?.[0] ?? null;
}

export class GermanApiClient {
  private cookie: string | null;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: GermanApiConfig, private readonly fetchImpl: FetchLike = fetch) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.cookie = config.sessionCookie?.split(";")[0] || null;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.cookie) return;
    if (this.config.mcpToken) {
      const response = await this.fetchImpl(`${this.baseUrl}/api/auth/mcp-token/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: this.config.mcpToken }),
      });
      if (!response.ok) throw new Error(`German API MCP token exchange failed with status ${response.status}.`);
      this.cookie = cookieValue(response.headers);
      if (!this.cookie) throw new Error("German API MCP token exchange succeeded but no session cookie was returned.");
      return;
    }
    if (!this.config.username || !this.config.password) {
      throw new Error("MCP authentication is not configured. Set GERMAN_API_MCP_TOKEN, GERMAN_API_SESSION_COOKIE, or GERMAN_API_USERNAME and GERMAN_API_PASSWORD.");
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: this.config.username, password: this.config.password }),
    });
    if (!response.ok) throw new Error(`German API authentication failed with status ${response.status}.`);
    this.cookie = cookieValue(response.headers);
    if (!this.cookie) throw new Error("German API authentication succeeded but no session cookie was returned.");
  }

  private async request<T>(path: string, init: RequestInit, retry = true): Promise<T> {
    await this.ensureAuthenticated();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Cookie", this.cookie!);
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
      if (response.status === 401 && retry && this.config.username && this.config.password) {
        this.cookie = null;
        await this.ensureAuthenticated();
        return this.request<T>(path, init, false);
      }

      const text = await response.text();
      let payload: unknown = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : `German API request failed with status ${response.status}.`;
        const error = new Error(message) as Error & { code?: string; status?: number };
        error.code = payload && typeof payload === "object" && "code" in payload ? String(payload.code) : "request_failed";
        error.status = response.status;
        throw error;
      }
      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
