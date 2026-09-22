using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace German.Api.Tests;

[TestClass]
public sealed class McpEndpointApiTests
{
    [TestMethod]
    public async Task McpEndpoint_RequiresBearerToken()
    {
        await using var factory = new GermanApiFactory();
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = JsonContent.Create(new
            {
                jsonrpc = "2.0",
                id = 1,
                method = "initialize",
                @params = new { protocolVersion = "2025-11-25", capabilities = new { }, clientInfo = new { name = "test", version = "1" } }
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

        var response = await client.SendAsync(request);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.IsTrue(response.Headers.WwwAuthenticate.Any(value => value.Scheme == "Bearer"));
    }

    [TestMethod]
    public async Task McpEndpoint_InitializesAndListsProductionTools()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var passwordService = services.GetRequiredService<IPasswordService>();
            var employee = new Employee { EmployeeCode = "MCP-01", FullName = "MCP Manager" };
            var account = new UserAccount
            {
                Username = "mcp-manager",
                NormalizedUsername = "MCP-MANAGER",
                Role = UserRole.Manager,
                EmployeeId = employee.Id
            };
            account.PasswordHash = passwordService.HashPassword(account, "secret");
            db.AddRange(employee, account);
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        var login = await client.PostAsJsonAsync("/api/auth/login", new { identifier = "mcp-manager", password = "secret" });
        Assert.AreEqual(HttpStatusCode.OK, login.StatusCode);
        var tokenResponse = await client.PostAsJsonAsync("/api/auth/mcp-token", new { });
        Assert.AreEqual(HttpStatusCode.OK, tokenResponse.StatusCode);
        var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
        var token = tokenJson.GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await SendMcpAsync(client, new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "initialize",
            @params = new
            {
                protocolVersion = "2025-11-25",
                capabilities = new { },
                clientInfo = new { name = "test-client", version = "1.0" }
            }
        });

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        StringAssert.Contains(body, "protocolVersion");
        StringAssert.Contains(body, "serverInfo");

        var tools = await SendMcpAsync(client, new { jsonrpc = "2.0", id = 2, method = "tools/list", @params = new { } });
        Assert.AreEqual(HttpStatusCode.OK, tools.StatusCode);
        var toolsBody = await tools.Content.ReadAsStringAsync();
        StringAssert.Contains(toolsBody, "find_employees");
        StringAssert.Contains(toolsBody, "get_production_summary");

        var call = await SendMcpAsync(client, new
        {
            jsonrpc = "2.0",
            id = 3,
            method = "tools/call",
            @params = new
            {
                name = "find_employees",
                arguments = new { search = "MCP" }
            }
        });
        Assert.AreEqual(HttpStatusCode.OK, call.StatusCode);
        StringAssert.Contains(await call.Content.ReadAsStringAsync(), "MCP Manager");

        var writeWithoutConfirmation = await SendMcpAsync(client, new
        {
            jsonrpc = "2.0",
            id = 4,
            method = "tools/call",
            @params = new
            {
                name = "create_production_entry",
                arguments = new
                {
                    input = new
                    {
                        requestId = "test-write-1",
                        workDate = "2026-09-22",
                        employeeId = Guid.NewGuid(),
                        productionOrderId = Guid.NewGuid(),
                        productionOperationId = Guid.NewGuid(),
                        entryMode = "Direct",
                        directHcQuantity = 1
                    },
                    confirm = false
                }
            }
        });
        Assert.AreEqual(HttpStatusCode.OK, writeWithoutConfirmation.StatusCode);
        StringAssert.Contains(await writeWithoutConfirmation.Content.ReadAsStringAsync(), "confirmation_required");
    }

    private static async Task<HttpResponseMessage> SendMcpAsync(HttpClient client, object payload)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        return await client.SendAsync(request);
    }
}
