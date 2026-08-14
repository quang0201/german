using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ProductionEntryMonthlyMatrixApiTests
{
    [TestMethod]
    public async Task MonthlyMatrix_AnonymousIsUnauthorized()
    {
        await using var factory = new GermanApiFactory();
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/api/production-entries/monthly-matrix?year=2026&month=8");
        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task MonthlyMatrix_WorkerIsForbidden()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "worker-matrix", "E901", UserRole.Worker);
        });
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "worker-matrix");
        var response = await client.GetAsync("/api/production-entries/monthly-matrix?year=2026&month=8");
        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [DataTestMethod]
    [DataRow(UserRole.Manager, "manager-matrix", "M901")]
    [DataRow(UserRole.Admin, "admin-matrix", "A901")]
    public async Task MonthlyMatrix_ManagerAndAdminReceiveMonthlyShape(
        UserRole role,
        string username,
        string employeeCode)
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var account = await AddAccountAsync(services, db, username, employeeCode, role);
            var order = new ProductionOrder { Code = $"{employeeCode}-0417", ProductName = "Mã hàng", PlannedQuantity = 1000m, Status = ProductionOrderStatus.InProduction };
            var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 4, Name = "CĐ4", Unit = "cái", SortOrder = 4 };
            db.AddRange(order, operation,
                NewEntry(account.Employee.Id, account.Account.Id, order.Id, operation.Id, new DateOnly(2026, 8, 16), 100m),
                NewEntry(account.Employee.Id, account.Account.Id, order.Id, operation.Id, new DateOnly(2026, 8, 17), 200m));
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, username);
        var response = await client.GetAsync("/api/production-entries/monthly-matrix?year=2026&month=8");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.IsTrue(json.RootElement.GetProperty("excludeSundays").GetBoolean());
        Assert.AreEqual("2026-08-01", json.RootElement.GetProperty("fromDate").GetString());
        Assert.AreEqual("2026-08-31", json.RootElement.GetProperty("untilDate").GetString());
        Assert.AreEqual(1, json.RootElement.GetProperty("summary").GetProperty("entryCount").GetInt32());
        Assert.AreEqual(1, json.RootElement.GetProperty("orders").GetArrayLength());
    }

    private static ProductionEntry NewEntry(Guid employeeId, Guid userId, Guid orderId, Guid operationId, DateOnly date, decimal hc) => new()
    {
        WorkDate = date,
        EmployeeId = employeeId,
        ProductionOrderId = orderId,
        ProductionOperationId = operationId,
        EntryMode = ProductionEntryMode.Direct,
        DirectHcQuantity = hc,
        DirectTcQuantity = 0m,
        HcQuantity = hc,
        TcQuantity = 0m,
        TotalQuantity = hc,
        SubmittedByUserId = userId
    };

    private static async Task<(UserAccount Account, Employee Employee)> AddAccountAsync(
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
        db.AddRange(employee, account);
        await db.SaveChangesAsync();
        return (account, employee);
    }

    private static async Task LoginAsync(HttpClient client, string username)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password = "secret" });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}
