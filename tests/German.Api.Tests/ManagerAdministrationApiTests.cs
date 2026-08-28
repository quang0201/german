using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using German.Application.Auth;
using German.Domain.Attendance;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ManagerAdministrationApiTests
{
    [TestMethod]
    public async Task Manager_CanCreateEmployeeWithRequiredShiftAssignment()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-employee-create", "M010", UserRole.Manager, "secret");
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-employee-create", "secret");
        var shiftResponse = await client.PostAsJsonAsync("/api/shift-templates", new
        {
            name = "Ca tạo nhân viên",
            periods = new[]
            {
                new { name = "Ca 1", startTime = "07:00:00", endTime = "11:30:00", sortOrder = 1 }
            }
        });
        Assert.AreEqual(HttpStatusCode.Created, shiftResponse.StatusCode);
        var shift = await shiftResponse.Content.ReadFromJsonAsync<JsonElement>();

        var response = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeCode = "E010",
            fullName = "Công nhân có ca",
            shiftTemplateId = shift.GetProperty("id").GetGuid(),
            effectiveFrom = "2026-08-17"
        });

        Assert.AreEqual(HttpStatusCode.Created, response.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var employee = await db.Employees.SingleAsync(x => x.EmployeeCode == "E010");
            var assignment = await db.EmployeeShiftAssignments.SingleAsync(x => x.EmployeeId == employee.Id);
            Assert.AreEqual(new DateOnly(2026, 8, 17), assignment.EffectiveFrom);
        });
    }

    [TestMethod]
    public async Task Manager_CannotCreateEmployeeWithoutShiftAssignment()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-employee-missing", "M011", UserRole.Manager, "secret");
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-employee-missing", "secret");
        var response = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeCode = "E011",
            fullName = "Thiếu bộ ca"
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            Assert.IsFalse(await db.Employees.AnyAsync(x => x.EmployeeCode == "E011"));
        });
    }

    [TestMethod]
    public async Task Manager_CannotCreateEmployeeWithInactiveShift()
    {
        await using var factory = new GermanApiFactory();
        Guid shiftId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-employee-inactive", "M012", UserRole.Manager, "secret");
            var shift = new ShiftTemplate { Name = "Ca đã tắt", IsActive = false };
            db.ShiftTemplates.Add(shift);
            shiftId = shift.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-employee-inactive", "secret");
        var response = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeCode = "E012",
            fullName = "Ca đã tắt",
            shiftTemplateId = shiftId,
            effectiveFrom = "2026-08-17"
        });

        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            Assert.IsFalse(await db.Employees.AnyAsync(x => x.EmployeeCode == "E012"));
        });
    }

    [TestMethod]
    public async Task Manager_CanDeleteEmployeeWithoutDeletingTheEmployeeRecord()
    {
        await using var factory = new GermanApiFactory();
        Guid employeeId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-employee-delete", "M013", UserRole.Manager, "secret");
            var employee = new Employee { EmployeeCode = "E013", FullName = "Nhân viên cần xóa" };
            var passwordService = services.GetRequiredService<IPasswordService>();
            var account = new UserAccount
            {
                Username = "employee-delete-history",
                NormalizedUsername = "EMPLOYEE-DELETE-HISTORY",
                Role = UserRole.Worker,
                EmployeeId = employee.Id
            };
            account.PasswordHash = passwordService.HashPassword(account, "worker-secret");
            var attendanceDay = new AttendanceDay
            {
                EmployeeId = employee.Id,
                WorkDate = new DateOnly(2026, 8, 17),
                OvertimeHours = 1m
            };
            attendanceDay.Shifts.Add(new AttendanceShiftEntry
            {
                AttendanceDayId = attendanceDay.Id,
                SlotNumber = 1,
                ShiftName = "Ca 1",
                ScheduledStartTime = new TimeOnly(7, 0),
                ScheduledEndTime = new TimeOnly(11, 0),
                ScheduledHours = 4m,
                ValueKind = AttendanceShiftValueKind.Hours,
                WorkedHours = 4m
            });
            var order = new ProductionOrder { Code = "DEL-013", ProductName = "Sản phẩm lịch sử", PlannedQuantity = 100m };
            var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 1, Name = "Công đoạn lịch sử", Unit = "cái", SortOrder = 1 };
            var productionEntry = new ProductionEntry
            {
                WorkDate = new DateOnly(2026, 8, 17),
                EmployeeId = employee.Id,
                ProductionOrderId = order.Id,
                ProductionOperationId = operation.Id,
                EntryMode = ProductionEntryMode.Direct,
                DirectHcQuantity = 10m,
                HcQuantity = 10m,
                TotalQuantity = 10m,
                SubmittedByUserId = account.Id
            };
            db.AddRange(employee, account, attendanceDay, order, operation, productionEntry);
            employeeId = employee.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-employee-delete", "secret");

        var response = await client.DeleteAsync($"/api/employees/{employeeId}");

        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var employee = await db.Employees.SingleAsync(x => x.Id == employeeId);
            Assert.IsFalse(employee.IsActive);
            Assert.AreEqual(DateOnly.FromDateTime(DateTime.UtcNow), employee.DeactivatedAt);
            Assert.IsTrue(await db.UserAccounts.AnyAsync(x => x.EmployeeId == employeeId && x.IsActive));
            Assert.IsTrue(await db.AttendanceDays.AnyAsync(x => x.EmployeeId == employeeId));
            Assert.IsTrue(await db.ProductionEntries.AnyAsync(x => x.EmployeeId == employeeId && !x.IsDeleted));
        });
    }

    [TestMethod]
    public async Task Manager_DeleteUnknownEmployeeReturnsNotFound()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-employee-delete-missing", "M014", UserRole.Manager, "secret");
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-employee-delete-missing", "secret");

        var response = await client.DeleteAsync($"/api/employees/{Guid.NewGuid()}");

        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    [TestMethod]
    public async Task DeletingEmployeeRejectsAnAlreadyIssuedWorkerSession()
    {
        await using var factory = new GermanApiFactory();
        Guid employeeId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-employee-session", "M015", UserRole.Manager, "secret");
            var passwordService = services.GetRequiredService<IPasswordService>();
            var employee = new Employee { EmployeeCode = "E015", FullName = "Session cần thu hồi" };
            var account = new UserAccount
            {
                Username = "worker-session-delete",
                NormalizedUsername = "WORKER-SESSION-DELETE",
                Role = UserRole.Worker,
                EmployeeId = employee.Id
            };
            account.PasswordHash = passwordService.HashPassword(account, "worker-secret");
            db.AddRange(employee, account);
            employeeId = employee.Id;
            await db.SaveChangesAsync();
        });

        using var manager = factory.CreateClient(new() { HandleCookies = true });
        using var worker = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(manager, "manager-employee-session", "secret");
        await LoginAsync(worker, "worker-session-delete", "worker-secret");

        var delete = await manager.DeleteAsync($"/api/employees/{employeeId}");
        Assert.AreEqual(HttpStatusCode.NoContent, delete.StatusCode);

        var me = await worker.GetAsync("/api/auth/me");

        Assert.AreEqual(HttpStatusCode.Unauthorized, me.StatusCode);
    }

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
    public async Task Manager_CanReadProductionOrderDetailWithOperationPrice()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-detail", "M004", UserRole.Manager, "secret");
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-detail", "secret");
        var createResponse = await client.PostAsJsonAsync("/api/production-orders", new
        {
            code = "SX-DETAIL",
            productName = "Áo chi tiết",
            plannedQuantity = 250,
            status = "Draft",
            operations = new[] { new { operationNumber = 10, name = "Cắt", unit = "cái", sortOrder = 1, fixedPrice = 25000.50m } }
        });
        Assert.AreEqual(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var detailResponse = await client.GetAsync($"/api/production-orders/{created.GetProperty("id").GetGuid()}");

        Assert.AreEqual(HttpStatusCode.OK, detailResponse.StatusCode);
        var detail = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.AreEqual(25000.50m, detail.GetProperty("operations")[0].GetProperty("fixedPrice").GetDecimal());
    }

    [TestMethod]
    public async Task Manager_CanDeleteOperationAndItsProductionEntries()
    {
        await using var factory = new GermanApiFactory();
        Guid orderId = Guid.Empty;
        Guid operationId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager-delete-operation", "M005", UserRole.Manager, "secret");
            await db.SaveChangesAsync();
            var account = await db.UserAccounts.SingleAsync(x => x.Username == "manager-delete-operation");
            var order = new ProductionOrder { Code = "0417", ProductName = "Áo xóa", PlannedQuantity = 100m };
            var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 567, Name = "CĐ567", Unit = "cái", SortOrder = 567 };
            db.AddRange(order, operation, new ProductionEntry
            {
                ProductionOrderId = order.Id,
                ProductionOperationId = operation.Id,
                EmployeeId = account.EmployeeId!.Value,
                SubmittedByUserId = account.Id,
                WorkDate = new DateOnly(2026, 8, 15),
            });
            await db.SaveChangesAsync();
            orderId = order.Id;
            operationId = operation.Id;
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager-delete-operation", "secret");

        var response = await client.PostAsync("/api/production-orders/0417/operations/567/cleanup", null);

        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            Assert.IsNotNull(await db.ProductionOrders.FindAsync(orderId));
            Assert.IsNull(await db.ProductionOperations.FindAsync(operationId));
            Assert.AreEqual(0, await db.ProductionEntries.IgnoreQueryFilters().CountAsync(x => x.ProductionOperationId == operationId));
        });
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
    public async Task Manager_CanListProductionEntries()
    {
        await using var factory = new GermanApiFactory();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "manager", "M003", UserRole.Manager, "secret");
            var worker = new Employee { EmployeeCode = "E300", FullName = "Bạch Thị Đào" };
            var order = new ProductionOrder { Code = "0701", ProductName = "Túi", PlannedQuantity = 5000m, Status = ProductionOrderStatus.InProduction };
            var operation = new ProductionOperation { ProductionOrderId = order.Id, OperationNumber = 11, Name = "May dải khóa", Unit = "cái", SortOrder = 11 };
            var entry = new ProductionEntry
            {
                WorkDate = new DateOnly(2026, 8, 11),
                EmployeeId = worker.Id,
                ProductionOrderId = order.Id,
                ProductionOperationId = operation.Id,
                EntryMode = ProductionEntryMode.Direct,
                DirectHcQuantity = 861m,
                DirectTcQuantity = 269m,
                HcQuantity = 861m,
                TcQuantity = 269m,
                TotalQuantity = 1130m,
                SubmittedByUserId = Guid.NewGuid()
            };
            db.AddRange(worker, order, operation, entry);
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager", "secret");

        var response = await client.GetAsync("/api/production-entries?date=2026-08-11");
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var rows = json.RootElement.GetProperty("items");
        Assert.AreEqual(1, rows.GetArrayLength());
        Assert.AreEqual("Bạch Thị Đào", rows[0].GetProperty("employeeName").GetString());
        Assert.AreEqual("0701", rows[0].GetProperty("productionOrderCode").GetString());
        Assert.AreEqual(1130m, rows[0].GetProperty("totalQuantity").GetDecimal());
    }

    [TestMethod]
    public async Task Admin_CanCreateWorkerAccount()
    {
        await using var factory = new GermanApiFactory();
        Guid workerId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            await AddAccountAsync(services, db, "admin", "A001", UserRole.Admin, "admin-secret");
            var worker = new Employee { EmployeeCode = "E400", FullName = "Hà Thị Quỳnh" };
            db.Employees.Add(worker);
            workerId = worker.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "admin", "admin-secret");

        var response = await client.PostAsJsonAsync("/api/admin/user-accounts", new
        {
            username = "quynh",
            password = "worker-secret",
            role = "Worker",
            employeeId = workerId
        });
        Assert.AreEqual(HttpStatusCode.Created, response.StatusCode);

        await client.PostAsync("/api/auth/logout", null);
        var login = await client.PostAsJsonAsync("/api/auth/login", new
        {
            identifier = "E400",
            password = "worker-secret"
        });
        Assert.AreEqual(HttpStatusCode.OK, login.StatusCode);
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
        var entries = await client.GetAsync("/api/production-entries");

        Assert.AreEqual(HttpStatusCode.Forbidden, employees.StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, orders.StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, entries.StatusCode);
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
