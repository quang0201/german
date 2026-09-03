using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
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

    [TestMethod]
    public async Task Export_Manager_ForwardsSearchFilter()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "manager3", "M003", UserRole.Manager, "secret");
        await SeedProductionEntryAsync(factory, "M003");
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "manager3", "secret");

        var response = await client.GetAsync($"{ExportUrl}&search=not-a-match");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        var management = GetWorksheetText(await response.Content.ReadAsByteArrayAsync(), "Báo cáo quản lý");
        Assert.IsFalse(management.Contains("manager3", StringComparison.Ordinal));

        var matchingResponse = await client.GetAsync($"{ExportUrl}&search=manager3");

        Assert.AreEqual(HttpStatusCode.OK, matchingResponse.StatusCode);
        var matchingManagement = GetWorksheetText(await matchingResponse.Content.ReadAsByteArrayAsync(), "Báo cáo quản lý");
        Assert.IsTrue(matchingManagement.Contains("manager3", StringComparison.Ordinal));
    }

    [TestMethod]
    public async Task Summary_Manager_ReturnsAllOrderOperationsIncludingZeroAndFiltersByDate()
    {
        await using var factory = new GermanApiFactory();
        await SeedAccountAsync(factory, "summary-manager", "M004", UserRole.Manager, "secret");
        var orderId = Guid.NewGuid();
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var employee = await db.Employees.SingleAsync(item => item.EmployeeCode == "M004");
            var account = await db.UserAccounts.SingleAsync(item => item.EmployeeId == employee.Id);
            var order = new ProductionOrder
            {
                Id = orderId,
                Code = "0417",
                ProductName = "Túi 0417",
                PlannedQuantity = 1000m,
                Status = ProductionOrderStatus.InProduction
            };
            var first = new ProductionOperation
            {
                ProductionOrderId = order.Id,
                OperationNumber = 11,
                Name = "May thân",
                Unit = "cái",
                SortOrder = 1
            };
            var second = new ProductionOperation
            {
                ProductionOrderId = order.Id,
                OperationNumber = 12,
                Name = "Đóng gói",
                Unit = "thùng",
                SortOrder = 2
            };
            var entry = new ProductionEntry
            {
                WorkDate = new DateOnly(2026, 8, 12),
                EmployeeId = employee.Id,
                ProductionOrderId = order.Id,
                ProductionOperationId = first.Id,
                EntryMode = ProductionEntryMode.Direct,
                HcQuantity = 100m,
                TcQuantity = 20m,
                TotalQuantity = 120m,
                SubmittedByUserId = account.Id
            };
            var external = new ProductionExternalQuantity
            {
                ProductionOrderId = order.Id,
                ProductionOperationId = first.Id,
                ReceivedDate = new DateOnly(2026, 8, 12),
                Quantity = 5000m,
                SubmittedByUserId = account.Id
            };
            db.AddRange(order, first, second, entry, external);
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "summary-manager", "secret");

        var response = await client.GetAsync(
            $"/api/reports/production/summary?orderId={orderId}&fromDate=2026-08-12&untilDate=2026-08-12");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;
        Assert.AreEqual("0417", root.GetProperty("orderCode").GetString());
        Assert.AreEqual("Túi 0417", root.GetProperty("productName").GetString());
        Assert.AreEqual(2, root.GetProperty("operationCount").GetInt32());
        var operations = root.GetProperty("operations");
        Assert.AreEqual(2, operations.GetArrayLength());
        Assert.AreEqual(120m, operations[0].GetProperty("totalQuantity").GetDecimal());
        Assert.AreEqual(5000m, operations[0].GetProperty("externalQuantity").GetDecimal());
        Assert.AreEqual(5120m, operations[0].GetProperty("combinedTotalQuantity").GetDecimal());
        Assert.AreEqual("thùng", operations[1].GetProperty("unit").GetString());
        Assert.AreEqual(0m, operations[1].GetProperty("totalQuantity").GetDecimal());
    }

    private static string GetWorksheetText(byte[] workbookBytes, string sheetName)
    {
        using var stream = new MemoryStream(workbookBytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var workbookPart = document.WorkbookPart
            ?? throw new AssertFailedException("Workbook part is missing.");
        var workbook = workbookPart.Workbook
            ?? throw new AssertFailedException("Workbook root is missing.");
        var sheet = workbook.Sheets?.Elements<Sheet>()
            .SingleOrDefault(item => item.Name?.Value == sheetName)
            ?? throw new AssertFailedException($"Worksheet '{sheetName}' is missing.");
        var relationshipId = sheet.Id?.Value
            ?? throw new AssertFailedException($"Worksheet '{sheetName}' relationship is missing.");
        var worksheetPart = workbookPart.GetPartById(relationshipId) as WorksheetPart
            ?? throw new AssertFailedException($"Worksheet '{sheetName}' part is missing.");
        var worksheet = worksheetPart.Worksheet
            ?? throw new AssertFailedException($"Worksheet '{sheetName}' root is missing.");
        return worksheet.InnerText;
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

    private static Task SeedProductionEntryAsync(GermanApiFactory factory, string employeeCode) =>
        factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var employee = await db.Employees.SingleAsync(item => item.EmployeeCode == employeeCode);
            var account = await db.UserAccounts.SingleAsync(item => item.EmployeeId == employee.Id);
            var order = new ProductionOrder
            {
                Code = "0417",
                ProductName = "Túi 0417",
                PlannedQuantity = 1000m,
                Status = ProductionOrderStatus.InProduction
            };
            var operation = new ProductionOperation
            {
                ProductionOrderId = order.Id,
                OperationNumber = 11,
                Name = "May thân",
                Unit = "cái",
                SortOrder = 1
            };
            var entry = new ProductionEntry
            {
                WorkDate = new DateOnly(2026, 8, 12),
                EmployeeId = employee.Id,
                ProductionOrderId = order.Id,
                ProductionOperationId = operation.Id,
                EntryMode = ProductionEntryMode.Direct,
                DirectHcQuantity = 100m,
                HcQuantity = 100m,
                TotalQuantity = 100m,
                SubmittedByUserId = account.Id,
                Note = "detail-only-marker"
            };
            db.AddRange(order, operation, entry);
            await db.SaveChangesAsync();
        });
}
