using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests.Attendance;

[TestClass]
public sealed class AttendanceApiTests
{
    [TestMethod]
    public async Task Attendance_IsManagerAdminOnly()
    {
        await using var factory = new GermanApiFactory();
        await SeedUsersAsync(factory);

        using var anonymous = factory.CreateClient();
        Assert.AreEqual(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync("/api/attendance/monthly?year=2026&month=8")).StatusCode);

        using var worker = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(worker, "attendance-worker", "secret");
        Assert.AreEqual(HttpStatusCode.Forbidden,
            (await worker.GetAsync("/api/attendance/monthly?year=2026&month=8")).StatusCode);

        using var manager = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(manager, "attendance-manager", "secret");
        Assert.AreEqual(HttpStatusCode.OK,
            (await manager.GetAsync("/api/attendance/monthly?year=2026&month=8")).StatusCode);

        using var admin = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(admin, "attendance-admin", "secret");
        Assert.AreEqual(HttpStatusCode.OK,
            (await admin.GetAsync("/api/attendance/monthly?year=2026&month=8")).StatusCode);
    }

    [TestMethod]
    public async Task Manager_CanReadDynamicShiftsAndSaveAttendance()
    {
        await using var factory = new GermanApiFactory();
        var employeeId = await SeedUsersAsync(factory, withShift: true);
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "attendance-manager", "secret");

        var get = await client.GetAsync($"/api/attendance/monthly?year=2026&month=8&employeeId={employeeId}");
        Assert.AreEqual(HttpStatusCode.OK, get.StatusCode);
        using var getJson = JsonDocument.Parse(await get.Content.ReadAsStringAsync());
        var day = getJson.RootElement.GetProperty("employees")[0].GetProperty("days")[0];
        Assert.AreEqual(2, day.GetProperty("shifts").GetArrayLength());
        Assert.IsTrue(day.GetProperty("hasShiftSetup").GetBoolean());
        Assert.AreEqual(4m, day.GetProperty("shifts")[0].GetProperty("scheduledHours").GetDecimal());

        var save = await client.PutAsJsonAsync("/api/attendance/monthly", new
        {
            year = 2026,
            month = 8,
            days = new[]
            {
                new
                {
                    employeeId,
                    workDate = "2026-08-16",
                    overtimeHours = 2,
                    shifts = new[]
                    {
                        new { slotNumber = 1, kind = "Hours", workedHours = (decimal?)4m },
                        new { slotNumber = 2, kind = "PaidLeave", workedHours = (decimal?)null }
                    }
                }
            }
        });

        Assert.AreEqual(HttpStatusCode.OK, save.StatusCode, await save.Content.ReadAsStringAsync());
        using var saveJson = JsonDocument.Parse(await save.Content.ReadAsStringAsync());
        var savedEmployee = saveJson.RootElement.GetProperty("employees").EnumerateArray()
            .Single(x => x.GetProperty("employeeId").GetGuid() == employeeId);
        var savedDay = savedEmployee.GetProperty("days").EnumerateArray()
            .Single(day => day.GetProperty("workDate").GetDateTime().Day == 16);
        Assert.AreEqual(2m, savedDay.GetProperty("overtimeHours").GetDecimal());
        Assert.AreEqual("PaidLeave", savedDay.GetProperty("shifts")[1].GetProperty("valueKind").GetString());
    }

    [TestMethod]
    public async Task Save_InvalidWorkedHours_ReturnsExistingErrorEnvelope()
    {
        await using var factory = new GermanApiFactory();
        var employeeId = await SeedUsersAsync(factory, withShift: true);
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "attendance-manager", "secret");

        var response = await client.PutAsJsonAsync("/api/attendance/monthly", new
        {
            year = 2026,
            month = 8,
            days = new[]
            {
                new
                {
                    employeeId,
                    workDate = "2026-08-16",
                    overtimeHours = 0,
                    shifts = new[] { new { slotNumber = 1, kind = "Hours", workedHours = 9m } }
                }
            }
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("attendance.invalid_value", json.RootElement.GetProperty("code").GetString());
    }

    [TestMethod]
    public async Task Manager_CanLoadAttendanceEmployeesByCursor()
    {
        await using var factory = new GermanApiFactory();
        await SeedUsersAsync(factory);
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "attendance-manager", "secret");

        var first = await client.GetFromJsonAsync<JsonElement>(
            "/api/attendance/monthly?year=2026&month=8&employeeLimit=1");
        Assert.AreEqual(1, first.GetProperty("employees").GetArrayLength());
        Assert.IsTrue(first.GetProperty("hasMoreEmployees").GetBoolean());
        var cursor = first.GetProperty("nextEmployeeCursor").GetString();
        Assert.IsFalse(string.IsNullOrWhiteSpace(cursor));

        var second = await client.GetFromJsonAsync<JsonElement>(
            $"/api/attendance/monthly?year=2026&month=8&employeeCursor={cursor}&employeeLimit=1");
        Assert.AreEqual(1, second.GetProperty("employees").GetArrayLength());
        Assert.AreNotEqual(
            first.GetProperty("employees")[0].GetProperty("employeeId").GetGuid(),
            second.GetProperty("employees")[0].GetProperty("employeeId").GetGuid());
    }

    [TestMethod]
    public async Task Manager_CanLoadAttendanceDayWindow()
    {
        await using var factory = new GermanApiFactory();
        var employeeId = await SeedUsersAsync(factory, withShift: true);
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "attendance-manager", "secret");

        var response = await client.GetFromJsonAsync<JsonElement>(
            $"/api/attendance/monthly?year=2026&month=8&employeeId={employeeId}&dayFrom=11&dayCount=10");
        var employee = response.GetProperty("employees")[0];

        Assert.AreEqual(10, employee.GetProperty("days").GetArrayLength());
        Assert.AreEqual(11, employee.GetProperty("days")[0].GetProperty("workDate").GetDateTime().Day);
        Assert.AreEqual(20, employee.GetProperty("days")[9].GetProperty("workDate").GetDateTime().Day);
        Assert.AreEqual(11, response.GetProperty("dayFrom").GetInt32());
        Assert.AreEqual(20, response.GetProperty("dayTo").GetInt32());
        Assert.AreEqual(21, response.GetProperty("nextDayFrom").GetInt32());
        Assert.IsTrue(response.GetProperty("hasMoreDays").GetBoolean());
    }

    [TestMethod]
    public async Task InvalidAttendanceDayWindowReturnsStableErrorEnvelope()
    {
        await using var factory = new GermanApiFactory();
        await SeedUsersAsync(factory);
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "attendance-manager", "secret");

        var response = await client.GetAsync("/api/attendance/monthly?year=2026&month=8&dayFrom=21&dayCount=12");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.AreEqual("attendance.invalid_day_window", json.RootElement.GetProperty("code").GetString());
    }

    private static async Task<Guid> SeedUsersAsync(GermanApiFactory factory, bool withShift = false)
    {
        var employeeId = Guid.Empty;
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var passwords = services.GetRequiredService<IPasswordService>();
            var managerEmployee = new Employee { EmployeeCode = "AMGR", FullName = "Manager" };
            var adminEmployee = new Employee { EmployeeCode = "AADM", FullName = "Admin" };
            var workerEmployee = new Employee { EmployeeCode = "AWKR", FullName = "Worker" };
            var employee = new Employee { EmployeeCode = "AATT", FullName = "Attendance" };
            db.AddRange(managerEmployee, adminEmployee, workerEmployee, employee);
            db.AddRange(
                Account("attendance-manager", UserRole.Manager, managerEmployee.Id, passwords),
                Account("attendance-admin", UserRole.Admin, adminEmployee.Id, passwords),
                Account("attendance-worker", UserRole.Worker, workerEmployee.Id, passwords));

            if (withShift)
            {
                var shift = new ShiftTemplate { Name = "Ca attendance" };
                shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 1", StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(11, 0), SortOrder = 1 });
                shift.Periods.Add(new ShiftPeriod { ShiftTemplateId = shift.Id, Name = "Ca 2", StartTime = new TimeOnly(13, 0), EndTime = new TimeOnly(17, 0), SortOrder = 2 });
                db.AddRange(shift, new EmployeeShiftAssignment
                {
                    EmployeeId = employee.Id,
                    ShiftTemplateId = shift.Id,
                    EffectiveFrom = new DateOnly(2026, 8, 1)
                });
            }

            employeeId = employee.Id;
            await db.SaveChangesAsync();
        });
        return employeeId;
    }

    private static UserAccount Account(string username, UserRole role, Guid employeeId, IPasswordService passwords)
    {
        var account = new UserAccount
        {
            Username = username,
            NormalizedUsername = username.ToUpperInvariant(),
            Role = role,
            EmployeeId = employeeId
        };
        account.PasswordHash = passwords.HashPassword(account, "secret");
        return account;
    }

    private static async Task LoginAsync(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}
