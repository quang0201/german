import { describe, expect, test } from "bun:test";
import { GermanApiClient } from "./germanApiClient.ts";

describe("German API client", () => {
  test("logs in with configured credentials and reuses the httpOnly cookie", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).endsWith("/api/auth/login")) {
        return new Response(JSON.stringify({ role: "Manager" }), {
          status: 200,
          headers: { "content-type": "application/json", "set-cookie": "german.auth=abc123; Path=/; HttpOnly" },
        });
      }
      return new Response(JSON.stringify([{ id: "source-a", name: "Hà", isActive: true }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = new GermanApiClient({
      baseUrl: "https://hr.quangt.com",
      username: "manager",
      password: "secret",
    }, fetchImpl);

    const result = await client.get("/api/production-external-sources");

    expect(result).toEqual([{ id: "source-a", name: "Hà", isActive: true }]);
    expect(requests).toHaveLength(2);
    expect(requests[0].init?.body).toContain("manager");
    expect(requests[0].init?.body).toContain("secret");
    expect((requests[1].init?.headers as Headers).get("Cookie")).toBe("german.auth=abc123");
  });

  test("does not allow a request without configured authentication", async () => {
    const client = new GermanApiClient({ baseUrl: "https://hr.quangt.com" }, fetch);

    await expect(client.get("/api/production-orders")).rejects.toThrow("authentication");
  });

  test("exchanges a reusable MCP token and reuses the returned session cookie", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).endsWith("/api/auth/mcp-token/exchange")) {
        return new Response(JSON.stringify({ role: "Manager" }), {
          status: 200,
          headers: { "content-type": "application/json", "set-cookie": "german.auth=exchanged123; Path=/; HttpOnly" },
        });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    };

    const client = new GermanApiClient({ baseUrl: "https://hr.quangt.com", mcpToken: "reusable-token" }, fetchImpl);
    await client.get("/api/production-orders");

    expect(requests).toHaveLength(2);
    expect(requests[0].init?.body).toContain("reusable-token");
    expect((requests[1].init?.headers as Headers).get("Cookie")).toBe("german.auth=exchanged123");
  });
});
