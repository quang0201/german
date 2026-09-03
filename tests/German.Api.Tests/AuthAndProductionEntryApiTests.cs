using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class AuthAndProductionEntryApiTests
{
    [TestMethod]
    public async Task Login_WithUsername_CreatesAuthenticatedCookie()
    {
        await using var factory = new GermanApiFactory();
        await SeedWorkerAsync(factory, "E001", "dao", "secret123");
        using var client = factory.CreateClient(new() { HandleCookies = true });

        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            identifier = "dao",
            password = "secret123"
        });

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.IsTrue(response.Headers.TryGetValues("Set-Cookie", out var cookies));
        Assert.IsTrue(cookies.Any(x => x.Contains("german.auth", StringComparison.OrdinalIgnoreCase)));
    }

    [TestMethod]
    public async Task Worker_CanSubmitByShift_ThroughApi()
    {
        await using var factory = new GermanApiFactory();
        var seeded = await SeedWorkerAsync(factory, "E002", "quynh", "secret456", withProductionData: true);
        using var client = factory.CreateClient(new() { HandleCookies = true });

        var login = await client.PostAsJsonAsync("/api/auth/login", new
        {
            identifier = "E002",
            password = "secret456"
        });
        Assert.AreEqual(HttpStatusCode.OK, login.StatusCode);

        var response = await client.PostAsJsonAsync("/api/production-entries", new
        {
            workDate = "2026-08-11",
            employeeId = seeded.EmployeeId,
            productionOrderId = seeded.OrderId,
            productionOperationId = seeded.OperationId,
            entryMode = "ByShift",
            shift1Quantity = 310,
            shift2Quantity = 120,
            overtimeHours = 2
        });

        Assert.AreEqual(HttpStatusCode.Created, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;
        Assert.AreEqual(352m, root.GetProperty("hcQuantity").GetDecimal());
        Assert.AreEqual(78m, root.GetProperty("tcQuantity").GetDecimal());
        Assert.AreEqual(430m, root.GetProperty("totalQuantity").GetDecimal());
    }

    private static async Task<SeededIds> SeedWorkerAsync(
        GermanApiFactory factory,
        string employeeCode,
        string username,
        string password,
        bool withProductionData = false)
    {
        var result = new SeededIds();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var passwordService = services.GetRequiredService<IPasswordService>();

            var employee = new Employee { EmployeeCode = employeeCode, FullName = username };
            var account = new UserAccount
            {
                Username = username,
                NormalizedUsername = username.ToUpperInvariant(),
                Role = UserRole.Worker,
                EmployeeId = employee.Id
            };
            account.PasswordHash = passwordService.HashPassword(account, password);
            db.AddRange(employee, account);

            result.EmployeeId = employee.Id;

            if (withProductionData)
            {
                var shift = new ShiftTemplate { Name = "Ca A" };
                shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 1", StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(11, 30), SortOrder = 1 });
                shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 2", StartTime = new TimeOnly(12, 30), EndTime = new TimeOnly(17, 0), SortOrder = 2 });
                var assignment = new EmployeeShiftAssignment
                {
                    EmployeeId = employee.Id,
                    ShiftTemplateId = shift.Id,
                    EffectiveFrom = new DateOnly(2026, 8, 1)
                };
                var order = new ProductionOrder
                {
                    Code = "0417",
                    ProductName = "Túi",
                    PlannedQuantity = 10000m,
                    Status = ProductionOrderStatus.InProduction
                };
                var operation = new ProductionOperation
                {
                    ProductionOrderId = order.Id,
                    OperationNumber = 15,
                    Name = "Viền hoàn thiện",
                    Unit = "cái",
                    SortOrder = 15
                };

                db.AddRange(shift, assignment, order, operation);
                result.OrderId = order.Id;
                result.OperationId = operation.Id;
            }

            await db.SaveChangesAsync();
        });
        return result;
    }

    private sealed class SeededIds
    {
        public Guid EmployeeId { get; set; }
        public Guid OrderId { get; set; }
        public Guid OperationId { get; set; }
    }
}
