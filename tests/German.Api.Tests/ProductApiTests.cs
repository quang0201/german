using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ProductApiTests
{
    private static readonly object[] Operations =
    [
        new { operationNumber = 1, name = "Cắt vải", unit = "cái", sortOrder = 1, fixedPrice = 1200 },
        new { operationNumber = 2, name = "May thân", unit = "cái", sortOrder = 2 }
    ];

    [TestMethod]
    public async Task Manager_CanCreateListUpdateAndDisableProducts()
    {
        await using var factory = new GermanApiFactory();
        using var client = await ManagerClientAsync(factory, "manager-product");

        var created = await client.PostAsJsonAsync("/api/products", new { code = "4004", name = "Túi 4004", operations = Operations });
        Assert.AreEqual(HttpStatusCode.Created, created.StatusCode);
        var product = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = product.GetProperty("id").GetGuid();
        Assert.AreEqual(2, product.GetProperty("operations").GetArrayLength());

        var duplicate = await client.PostAsJsonAsync("/api/products", new { code = "4004", name = "Khác", operations = Operations });
        Assert.AreEqual(HttpStatusCode.Conflict, duplicate.StatusCode);

        var updated = await client.PutAsJsonAsync($"/api/products/{id}", new { code = "4004", name = "Túi 4004 mới", isActive = true, operations = Operations.Take(1) });
        Assert.AreEqual(HttpStatusCode.OK, updated.StatusCode);
        Assert.AreEqual(1, (await updated.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("operations").GetArrayLength());

        var list = await client.GetFromJsonAsync<JsonElement>("/api/products");
        Assert.AreEqual(1, list.GetArrayLength());

        Assert.AreEqual(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/products/{id}")).StatusCode);
        var afterDisable = await client.GetFromJsonAsync<JsonElement>($"/api/products/{id}");
        Assert.IsFalse(afterDisable.GetProperty("isActive").GetBoolean());
        Assert.AreEqual(HttpStatusCode.NotFound, (await client.GetAsync($"/api/products/{Guid.NewGuid()}")).StatusCode);
    }

    [TestMethod]
    public async Task ProductionOrder_CreatedWithProduct_CopiesTemplateAndReportsProductCode()
    {
        await using var factory = new GermanApiFactory();
        using var client = await ManagerClientAsync(factory, "manager-product-order");
        var product = await (await client.PostAsJsonAsync("/api/products", new { code = "4004", name = "Túi 4004", operations = Operations }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var productId = product.GetProperty("id").GetGuid();

        var created = await client.PostAsJsonAsync("/api/production-orders", new
        {
            code = "4004 xanh",
            productName = "Túi 4004 xanh",
            plannedQuantity = 100,
            status = 1,
            productId
        });

        Assert.AreEqual(HttpStatusCode.Created, created.StatusCode);
        var order = await created.Content.ReadFromJsonAsync<JsonElement>();
        Assert.AreEqual(productId, order.GetProperty("productId").GetGuid());
        Assert.AreEqual("4004", order.GetProperty("productCode").GetString());
        Assert.AreEqual(2, order.GetProperty("operations").GetArrayLength());

        var unknown = await client.PostAsJsonAsync("/api/production-orders", new
        {
            code = "9999",
            productName = "X",
            plannedQuantity = 1,
            status = 1,
            productId = Guid.NewGuid()
        });
        Assert.AreEqual(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [TestMethod]
    public async Task Worker_CannotUseProductEndpoints()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "worker-product", "W900", UserRole.Worker);
            await db.SaveChangesAsync();
        });
        using var client = factory.CreateClient(new() { HandleCookies = true });
        var login = await client.PostAsJsonAsync("/api/auth/login", new { identifier = "worker-product", password = "secret" });
        Assert.AreEqual(HttpStatusCode.OK, login.StatusCode);

        Assert.AreEqual(HttpStatusCode.Forbidden, (await client.GetAsync("/api/products")).StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/products", new { code = "1", name = "x" })).StatusCode);
    }

    private static async Task<HttpClient> ManagerClientAsync(GermanApiFactory factory, string username)
    {
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, username, "M900", UserRole.Manager);
            await db.SaveChangesAsync();
        });
        var client = factory.CreateClient(new() { HandleCookies = true });
        var login = await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password = "secret" });
        Assert.AreEqual(HttpStatusCode.OK, login.StatusCode);
        return client;
    }

    private static Task AddAccountAsync(IServiceProvider services, GermanDbContext db, string username, string employeeCode, UserRole role)
    {
        var employee = new Employee { EmployeeCode = employeeCode, FullName = username };
        var account = new UserAccount
        {
            Username = username,
            NormalizedUsername = username.ToUpperInvariant(),
            Role = role,
            EmployeeId = employee.Id
        };
        account.PasswordHash = services.GetRequiredService<IPasswordService>().HashPassword(account, "secret");
        db.AddRange(employee, account);
        return Task.CompletedTask;
    }
}
