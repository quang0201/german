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
public sealed class ManagerAdministrationApiTests
{
    [TestMethod]
    public async Task Manager_CanCreateProductionOrderByCloningOperations()
    {
        await using var factory = new GermanApiFactory();
        Guid sourceOrderId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager", "M001", UserRole.Manager, "secret");

            var source = new ProductionOrder
            {
                Code = "0417",
                ProductName = "Túi mẫu",
                PlannedQuantity = 10000m,
                Status = ProductionOrderStatus.Completed
            };
            db.ProductionOrders.Add(source);
            db.ProductionOperations.AddRange(
                new ProductionOperation { ProductionOrderId = source.Id, OperationNumber = 1, Name = "Cắt", Unit = "cái", SortOrder = 1 },
                new ProductionOperation { ProductionOrderId = source.Id, OperationNumber = 2, Name = "May", Unit = "cái", SortOrder = 2 });
            sourceOrderId = source.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager", "secret");

        var response = await client.PostAsJsonAsync("/api/production-orders", new
        {
            code = "0521",
            productName = "Túi mới",
            plannedQuantity = 5000,
            status = "Draft",
            cloneFromOrderId = sourceOrderId
        });

        Assert.AreEqual(HttpStatusCode.Created, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;
        Assert.AreEqual("0521", root.GetProperty("code").GetString());
        Assert.AreEqual(2, root.GetProperty("operations").GetArrayLength());
        Assert.AreEqual(1, root.GetProperty("operations")[0].GetProperty("operationNumber").GetInt32());
    }

    [TestMethod]
    public async Task Manager_CanCreateShiftAndAssignEmployee()
    {
        await using var factory = new GermanApiFactory();
        Guid employeeId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager", "M002", UserRole.Manager, "secret");
            var employee = new Employee { EmployeeCode = "E100", FullName = "Công nhân A" };
            db.Employees.Add(employee);
            employeeId = employee.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager", "secret");

        var shiftResponse = await client.PostAsJsonAsync("/api/shift-templates", new
        {
            name = "Ca A",
            periods = new[]
            {
                new { name = "Ca 1", startTime = "07:00:00", endTime = "11:30:00", sortOrder = 1 },
                new { name = "Ca 2", startTime = "12:30:00", endTime = "17:00:00", sortOrder = 2 }
            }
        });
        Assert.AreEqual(HttpStatusCode.Created, shiftResponse.StatusCode);
        using var shiftJson = JsonDocument.Parse(await shiftResponse.Content.ReadAsStringAsync());
        var shiftId = shiftJson.RootElement.GetProperty("id").GetGuid();

        var assignmentResponse = await client.PostAsJsonAsync($"/api/employees/{employeeId}/shift-assignments", new
        {
            shiftTemplateId = shiftId,
            effectiveFrom = "2026-08-01"
        });

        Assert.AreEqual(HttpStatusCode.Created, assignmentResponse.StatusCode);
    }

    [TestMethod]
    public async Task Worker_CannotAccessManagerAdministrationEndpoints()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "worker", "E200", UserRole.Worker, "secret");
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "worker", "secret");

        var employees = await client.GetAsync("/api/employees");
        var orders = await client.GetAsync("/api/production-orders");

        Assert.AreEqual(HttpStatusCode.Forbidden, employees.StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, orders.StatusCode);
    }

    private static async Task AddAccountAsync(
        IServiceProvider services,
        GermanDbContext db,
        string username,
        string employeeCode,
        UserRole role,
        string password)
    {
        var passwordService = services.GetRequiredService<IPasswordService>();
        var employee = new Employee { EmployeeCode = employeeCode, FullName = username };
        var account = new UserAccount
        {
            Username = username,
            NormalizedUsername = username.ToUpperInvariant(),
            Role = role,
            EmployeeId = employee.Id
        };
        account.PasswordHash = passwordService.HashPassword(account, password);
        db.AddRange(employee, account);
        await Task.CompletedTask;
    }

    private static async Task LoginAsync(HttpClient client, string identifier, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier, password });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}
