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
public sealed class ProductionEntryBatchDirectApiTests
{
    [TestMethod]
    public async Task BatchDirect_WorkerIsForbidden()
    {
        await using var factory = new GermanApiFactory();
        BatchSeed seed = default!;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            seed = await SeedAsync(services, db, "worker-batch", "E920", UserRole.Worker);
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "worker-batch");
        var response = await client.PostAsJsonAsync("/api/production-entries/batch-direct", Payload(seed));

        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            Assert.AreEqual(0, await db.ProductionEntries.CountAsync());
        });
    }

    [TestMethod]
    public async Task BatchDirect_ManagerCreatesAllRowsAndReturnsCount()
    {
        await using var factory = new GermanApiFactory();
        BatchSeed seed = default!;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            seed = await SeedAsync(services, db, "manager-batch", "M920", UserRole.Manager);
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-batch");
        var response = await client.PostAsJsonAsync("/api/production-entries/batch-direct", Payload(seed));

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual(2, json.RootElement.GetProperty("createdCount").GetInt32());
        Assert.AreEqual(2, json.RootElement.GetProperty("entries").GetArrayLength());
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            Assert.AreEqual(2, await db.ProductionEntries.CountAsync());
        });
    }

    [TestMethod]
    public async Task BatchDirect_ConflictReturns409AndCreatesNothingNew()
    {
        await using var factory = new GermanApiFactory();
        BatchSeed seed = default!;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            seed = await SeedAsync(services, db, "manager-conflict", "M921", UserRole.Manager);
            db.ProductionEntries.Add(new ProductionEntry
            {
                WorkDate = new DateOnly(2026, 8, 27),
                EmployeeId = seed.Employee.Id,
                ProductionOrderId = seed.Order.Id,
                ProductionOperationId = seed.Operations[1].Id,
                EntryMode = ProductionEntryMode.Direct,
                DirectHcQuantity = 5m,
                DirectTcQuantity = 0m,
                HcQuantity = 5m,
                TcQuantity = 0m,
                TotalQuantity = 5m,
                SubmittedByUserId = seed.Account.Id
            });
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-conflict");
        var response = await client.PostAsJsonAsync("/api/production-entries/batch-direct", Payload(seed));

        Assert.AreEqual(HttpStatusCode.Conflict, response.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            Assert.AreEqual(1, await db.ProductionEntries.CountAsync());
        });
    }

    [TestMethod]
    public async Task BatchDirect_EmptyBatchMapsApplicationError()
    {
        await using var factory = new GermanApiFactory();
        BatchSeed seed = default!;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            seed = await SeedAsync(services, db, "manager-empty", "M922", UserRole.Manager);
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-empty");
        var response = await client.PostAsJsonAsync("/api/production-entries/batch-direct", new
        {
            workDate = "2026-08-27",
            employeeId = seed.Employee.Id,
            productionOrderId = seed.Order.Id,
            items = Array.Empty<object>()
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("production_entry.batch_empty", json.RootElement.GetProperty("code").GetString());
    }

    [TestMethod]
    public async Task BatchDirect_ExplicitNullItemsMapsEmptyBatchInsteadOf500()
    {
        await using var factory = new GermanApiFactory();
        BatchSeed seed = default!;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            seed = await SeedAsync(services, db, "manager-null", "M923", UserRole.Manager);
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-null");
        var response = await client.PostAsJsonAsync("/api/production-entries/batch-direct", new
        {
            workDate = "2026-08-27",
            employeeId = seed.Employee.Id,
            productionOrderId = seed.Order.Id,
            items = (object?)null
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("production_entry.batch_empty", json.RootElement.GetProperty("code").GetString());
    }

    private static object Payload(BatchSeed seed) => new
    {
        workDate = "2026-08-27",
        employeeId = seed.Employee.Id,
        productionOrderId = seed.Order.Id,
        items = seed.Operations.Select((operation, index) => new
        {
            productionOperationId = operation.Id,
            directHcQuantity = 100m + index,
            directTcQuantity = 10m + index,
            note = (string?)null
        }).ToArray()
    };

    private static async Task<BatchSeed> SeedAsync(
        IServiceProvider services,
        GermanDbContext db,
        string username,
        string employeeCode,
        UserRole role)
    {
        var employee = new Employee { EmployeeCode = employeeCode, FullName = username };
        var account = new UserAccount
        {
            Username = username,
            NormalizedUsername = username.ToUpperInvariant(),
            Role = role,
            EmployeeId = employee.Id,
            PasswordHash = services.GetRequiredService<IPasswordService>().HashPassword(
                new UserAccount { Username = username }, "secret")
        };
        var order = new ProductionOrder
        {
            Code = $"{employeeCode}-BATCH",
            ProductName = "Sản phẩm",
            PlannedQuantity = 1000m,
            Status = ProductionOrderStatus.InProduction
        };
        var operations = new[]
        {
            new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "CĐ4", Unit = "cái", SortOrder = 4 },
            new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 5, Name = "CĐ5", Unit = "cái", SortOrder = 5 }
        };
        db.AddRange(employee, account, order);
        db.ProductionOperations.AddRange(operations);
        await db.SaveChangesAsync();
        return new BatchSeed(account, employee, order, operations);
    }

    private static async Task LoginAsync(HttpClient client, string username)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password = "secret" });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed record BatchSeed(
        UserAccount Account,
        Employee Employee,
        ProductionOrder Order,
        ProductionOperation[] Operations);
}
