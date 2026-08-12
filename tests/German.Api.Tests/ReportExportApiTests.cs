using System.Net;
using System.Net.Http.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ReportExportApiTests
{
    private const string ExportUrl =
        "/api/reports/production/export.xlsx?fromDate=2026-08-12&untilDate=2026-08-12";

    [TestMethod]
    public async Task Export_Anonymous_ReturnsUnauthorized()
    {
        await using var factory = new GermanApiFactory();
        using var client = factory.CreateClient(new() { HandleCookies = true });

        var response = await client.GetAsync(ExportUrl);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task Export_Worker_ReturnsForbidden()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "worker", "E001", UserRole.Worker, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "worker", "secret");

        var response = await client.GetAsync(ExportUrl);

        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [TestMethod]
    public async Task Export_Manager_ReturnsXlsx()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "manager", "M001", UserRole.Manager, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager", "secret");

        var response = await client.GetAsync(ExportUrl);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.AreEqual(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            response.Content.Headers.ContentType?.MediaType);
        Assert.IsTrue((await response.Content.ReadAsByteArrayAsync()).Length > 0);
        Assert.AreEqual(
            "san-luong_20260812_20260812.xlsx",
            response.Content.Headers.ContentDisposition?.FileNameStar ??
            response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
    }

    [TestMethod]
    public async Task Export_Admin_ReturnsXlsx()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "admin", "A001", UserRole.Admin, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "admin", "secret");

        var response = await client.GetAsync(ExportUrl);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [TestMethod]
    public async Task Export_InvalidDateRange_ReturnsBadRequest()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "manager2", "M002", UserRole.Manager, "secret");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager2", "secret");

        var response = await client.GetAsync(
            "/api/reports/production/export.xlsx?fromDate=2026-08-13&untilDate=2026-08-12");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task SeedAccountAsync(
        GermanApiFactory factory,
        string username,
        string employeeCode,
        UserRole role,
        string password)
    {
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
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
            await db.SaveChangesAsync();
        });
    }

    private static async Task LoginAsync(HttpClient client, string identifier, string password)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { identifier, password });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}
