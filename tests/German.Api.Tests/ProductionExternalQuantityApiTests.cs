using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ProductionExternalQuantityApiTests
{
    [TestMethod]
    public async Task ManagerCanCreateListUpdateAndDeleteWithoutChangingInternalEntries()
    {
        await using var factory = new GermanApiFactory();
        Guid orderId = Guid.Empty;
        Guid operationId = Guid.Empty;
        Guid entryId = Guid.Empty;
        await SeedAsync(factory, UserRole.Manager, "external-manager", "M900", seedProduction: true, ids =>
        {
            orderId = ids.OrderId;
            operationId = ids.OperationId;
            entryId = ids.EntryId;
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "external-manager", "secret");
        var create = await client.PostAsJsonAsync("/api/production-external-quantities", new
        {
            productionOrderId = orderId,
            productionOperationId = operationId,
            receivedDate = "2026-08-22",
            quantity = 5000m,
            sourceName = " Xưởng ngoài A ",
            note = " Nhận hàng "
        });
        Assert.AreEqual(HttpStatusCode.Created, create.StatusCode);
        using var createdJson = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        var externalId = createdJson.RootElement.GetProperty("id").GetGuid();
        Assert.AreEqual("Xưởng ngoài A", createdJson.RootElement.GetProperty("sourceName").GetString());

        var list = await client.GetAsync($"/api/production-external-quantities?orderId={orderId}&operationId={operationId}");
        Assert.AreEqual(HttpStatusCode.OK, list.StatusCode);
        Assert.AreEqual(1, (await JsonDocument.ParseAsync(await list.Content.ReadAsStreamAsync())).RootElement.GetArrayLength());

        var update = await client.PutAsJsonAsync($"/api/production-external-quantities/{externalId}", new
        {
            receivedDate = "2026-08-23",
            quantity = 7000m,
            sourceName = "Xưởng ngoài B",
            note = (string?)null
        });
        Assert.AreEqual(HttpStatusCode.OK, update.StatusCode);

        var delete = await client.DeleteAsync($"/api/production-external-quantities/{externalId}");
        Assert.AreEqual(HttpStatusCode.NoContent, delete.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            Assert.IsNotNull(await db.ProductionEntries.SingleAsync(item => item.Id == entryId));
            Assert.AreEqual(0, await db.ProductionExternalQuantities.CountAsync());
        });
    }

    [TestMethod]
    public async Task WorkerCannotManageExternalQuantity()
    {
        await using var factory = new GermanApiFactory();
        Guid orderId = Guid.Empty;
        Guid operationId = Guid.Empty;
        await SeedAsync(factory, UserRole.Worker, "external-worker", "W900", seedProduction: true, ids =>
        {
            orderId = ids.OrderId;
            operationId = ids.OperationId;
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "external-worker", "secret");
        var response = await client.PostAsJsonAsync("/api/production-external-quantities", new
        {
            productionOrderId = orderId,
            productionOperationId = operationId,
            receivedDate = "2026-08-22",
            quantity = 1m
        });

        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [TestMethod]
    public async Task ManagerCannotCreateNonPositiveExternalQuantity()
    {
        await using var factory = new GermanApiFactory();
        Guid orderId = Guid.Empty;
        Guid operationId = Guid.Empty;
        await SeedAsync(factory, UserRole.Manager, "external-invalid", "M901", seedProduction: true, ids =>
        {
            orderId = ids.OrderId;
            operationId = ids.OperationId;
        });
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "external-invalid", "secret");

        var response = await client.PostAsJsonAsync("/api/production-external-quantities", new
        {
            productionOrderId = orderId,
            productionOperationId = operationId,
            receivedDate = "2026-08-22",
            quantity = 0m
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("production_external_quantity.invalid_quantity", json.RootElement.GetProperty("code").GetString());
    }

    private static async Task SeedAsync(GermanApiFactory factory, UserRole role, string username, string employeeCode, bool seedProduction, Action<SeedIds> capture)
    {
        var ids = new SeedIds();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var passwordService = services.GetRequiredService<IPasswordService>();
            var employee = new Employee { EmployeeCode = employeeCode, FullName = username };
            var account = new UserAccount { Username = username, NormalizedUsername = username.ToUpperInvariant(), Role = role, EmployeeId = employee.Id };
            account.PasswordHash = passwordService.HashPassword(account, "secret");
            db.AddRange(employee, account);
            if (seedProduction)
            {
                var order = new ProductionOrder { Code = $"O-{employeeCode}", ProductName = "Sản phẩm", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
                var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "May", Unit = "cái", SortOrder = 1 };
                var entry = new ProductionEntry
                {
                    EmployeeId = employee.Id,
                    ProductionOrderId = order.Id,
                    ProductionOperationId = operation.Id,
                    WorkDate = new DateOnly(2026, 8, 22),
                    EntryMode = ProductionEntryMode.Direct,
                    HcQuantity = 10m,
                    TotalQuantity = 10m,
                    SubmittedByUserId = account.Id
                };
                db.AddRange(order, operation, entry);
                ids.OrderId = order.Id;
                ids.OperationId = operation.Id;
                ids.EntryId = entry.Id;
            }
            await db.SaveChangesAsync();
        });
        capture(ids);
    }

    private static async Task LoginAsync(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class SeedIds
    {
        public Guid OrderId { get; set; }
        public Guid OperationId { get; set; }
        public Guid EntryId { get; set; }
    }
}
