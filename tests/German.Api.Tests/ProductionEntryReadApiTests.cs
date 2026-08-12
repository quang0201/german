using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Auditing;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ProductionEntryReadApiTests
{
    [TestMethod]
    public async Task Worker_MineReturnsOnlyOwnEntries()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var worker = await AddAccountAsync(services, db, "worker", "E001", UserRole.Worker, "secret");
            var other = new Employee { EmployeeCode = "E002", FullName = "Người khác" };
            db.Employees.Add(other);
            await AddEntryAsync(db, worker.Employee.Id, worker.Account.Id, "E001");
            await AddEntryAsync(db, other.Id, worker.Account.Id, "E002");
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "worker", "secret");
        var response = await client.GetAsync("/api/production-entries/mine?fromDate=2026-08-12&untilDate=2026-08-12");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var items = json.RootElement.GetProperty("items");
        Assert.AreEqual(1, items.GetArrayLength());
        Assert.AreEqual("E001", items[0].GetProperty("employeeCode").GetString());
    }

    [TestMethod]
    public async Task Worker_CannotReadOtherWorkersDetail()
    {
        await using var factory = new GermanApiFactory();
        Guid entryId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var worker = await AddAccountAsync(services, db, "worker", "E001", UserRole.Worker, "secret");
            var other = new Employee { EmployeeCode = "E002", FullName = "Người khác" };
            var entry = await AddEntryAsync(db, other.Id, worker.Account.Id, "E002");
            db.Employees.Add(other);
            entryId = entry.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "worker", "secret");
        var response = await client.GetAsync($"/api/production-entries/{entryId}");

        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [TestMethod]
    public async Task Manager_DetailIncludesRawAndDisplayFields()
    {
        await using var factory = new GermanApiFactory();
        Guid entryId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var manager = await AddAccountAsync(services, db, "manager", "M001", UserRole.Manager, "secret");
            var entry = await AddEntryAsync(db, manager.Employee.Id, manager.Account.Id, "M001");
            entry.DirectHcQuantity = 35m;
            entry.DirectTcQuantity = 5m;
            entry.HcQuantity = 35m;
            entry.TcQuantity = 5m;
            entry.TotalQuantity = 40m;
            entryId = entry.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager", "secret");
        var response = await client.GetAsync($"/api/production-entries/{entryId}");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("M001", json.RootElement.GetProperty("employeeCode").GetString());
        Assert.AreEqual(35m, json.RootElement.GetProperty("directHcQuantity").GetDecimal());
        Assert.AreEqual("manager", json.RootElement.GetProperty("submittedByUsername").GetString());
    }

    [TestMethod]
    public async Task Admin_CanReadAuditLogs_WorkerCannot()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var admin = await AddAccountAsync(services, db, "admin", "A001", UserRole.Admin, "secret");
            db.AuditLogs.Add(new AuditLog
            {
                EntityType = "ProductionEntry",
                EntityId = Guid.NewGuid(),
                Action = AuditAction.Update,
                PerformedByUserId = admin.Account.Id,
                BeforeJson = "{}",
                AfterJson = "{}"
            });
            await db.SaveChangesAsync();
        });

        using var adminClient = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(adminClient, "admin", "secret");
        var adminResponse = await adminClient.GetAsync("/api/audit-logs?fromDate=2026-08-12&untilDate=2026-08-12");
        Assert.AreEqual(HttpStatusCode.OK, adminResponse.StatusCode);

        await adminClient.PostAsync("/api/auth/logout", null);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "worker", "E001", UserRole.Worker, "secret");
            await db.SaveChangesAsync();
        });
        await LoginAsync(adminClient, "worker", "secret");
        var workerResponse = await adminClient.GetAsync("/api/audit-logs");
        Assert.AreEqual(HttpStatusCode.Forbidden, workerResponse.StatusCode);
    }

    private static async Task<(UserAccount Account, Employee Employee)> AddAccountAsync(
        IServiceProvider services,
        GermanDbContext db,
        string username,
        string employeeCode,
        UserRole role,
        string password)
    {
        var employee = new Employee { EmployeeCode = employeeCode, FullName = username };
        var account = new UserAccount
        {
            Username = username,
            NormalizedUsername = username.ToUpperInvariant(),
            Role = role,
            EmployeeId = employee.Id,
            PasswordHash = services.GetRequiredService<IPasswordService>().HashPassword(
                new UserAccount { Username = username }, password)
        };
        db.AddRange(employee, account);
        await db.SaveChangesAsync();
        return (account, employee);
    }

    private static async Task<ProductionEntry> AddEntryAsync(
        GermanDbContext db,
        Guid employeeId,
        Guid submittedByUserId,
        string code)
    {
        var order = new ProductionOrder
        {
            Code = $"{code}-ORDER",
            ProductName = "Sản phẩm",
            PlannedQuantity = 100m,
            Status = ProductionOrderStatus.InProduction
        };
        var operation = new ProductionOperation
        {
            ProductionOrderId = order.Id,
            OperationNumber = 10,
            Name = "Lắp ráp",
            Unit = "cái",
            SortOrder = 1
        };
        var entry = new ProductionEntry
        {
            WorkDate = new DateOnly(2026, 8, 12),
            EmployeeId = employeeId,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = 10m,
            DirectTcQuantity = 0m,
            HcQuantity = 10m,
            TcQuantity = 0m,
            TotalQuantity = 10m,
            SubmittedByUserId = submittedByUserId
        };
        db.AddRange(order, operation, entry);
        await db.SaveChangesAsync();
        return entry;
    }

    private static async Task LoginAsync(HttpClient client, string identifier, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier, password });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}
