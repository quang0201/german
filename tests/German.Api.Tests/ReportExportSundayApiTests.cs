using System.Net;
using System.Net.Http.Json;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ReportExportSundayApiTests
{
    [TestMethod]
    public async Task Export_ExcludeSundaysTrue_RemovesSundayWhileOmittedParameterKeepsIt()
    {
        await using var factory = new GermanApiFactory();
        await SeedManagerAndEntriesAsync(factory);
        using var client = factory.CreateClient(new() { HandleCookies = true });
        await LoginAsync(client, "sunday-manager", "secret");

        var excludedResponse = await client.GetAsync(
            "/api/reports/production/export.xlsx?fromDate=2026-08-16&untilDate=2026-08-17&excludeSundays=true");

        Assert.AreEqual(HttpStatusCode.OK, excludedResponse.StatusCode);
        var excludedDetail = GetWorksheetText(
            await excludedResponse.Content.ReadAsByteArrayAsync(),
            "Chi tiết");
        Assert.IsFalse(excludedDetail.Contains("sunday-marker", StringComparison.Ordinal));
        Assert.IsTrue(excludedDetail.Contains("monday-marker", StringComparison.Ordinal));

        var compatibleResponse = await client.GetAsync(
            "/api/reports/production/export.xlsx?fromDate=2026-08-16&untilDate=2026-08-17");

        Assert.AreEqual(HttpStatusCode.OK, compatibleResponse.StatusCode);
        var compatibleDetail = GetWorksheetText(
            await compatibleResponse.Content.ReadAsByteArrayAsync(),
            "Chi tiết");
        Assert.IsTrue(compatibleDetail.Contains("sunday-marker", StringComparison.Ordinal));
        Assert.IsTrue(compatibleDetail.Contains("monday-marker", StringComparison.Ordinal));
    }

    private static async Task SeedManagerAndEntriesAsync(GermanApiFactory factory)
    {
        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var passwordService = services.GetRequiredService<IPasswordService>();
            var employee = new Employee { EmployeeCode = "M-SUN", FullName = "Sunday Manager" };
            var account = new UserAccount
            {
                Username = "sunday-manager",
                NormalizedUsername = "SUNDAY-MANAGER",
                Role = UserRole.Manager,
                EmployeeId = employee.Id
            };
            account.PasswordHash = passwordService.HashPassword(account, "secret");
            var order = new ProductionOrder
            {
                Code = "SUN-01",
                ProductName = "Sunday test product",
                PlannedQuantity = 1000m,
                Status = ProductionOrderStatus.InProduction
            };
            var operation = new ProductionOperation
            {
                ProductionOrderId = order.Id,
                OperationNumber = 12,
                Name = "Test operation",
                Unit = "cái",
                SortOrder = 1
            };
            var sunday = Entry(
                new DateOnly(2026, 8, 16),
                70m,
                10m,
                "sunday-marker",
                employee,
                order,
                operation,
                account);
            var monday = Entry(
                new DateOnly(2026, 8, 17),
                30m,
                5m,
                "monday-marker",
                employee,
                order,
                operation,
                account);

            db.AddRange(employee, account, order, operation, sunday, monday);
            await db.SaveChangesAsync();
        });
    }

    private static ProductionEntry Entry(
        DateOnly date,
        decimal hc,
        decimal tc,
        string note,
        Employee employee,
        ProductionOrder order,
        ProductionOperation operation,
        UserAccount account)
        => new()
        {
            WorkDate = date,
            EmployeeId = employee.Id,
            ProductionOrderId = order.Id,
            ProductionOperationId = operation.Id,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = hc,
            DirectTcQuantity = tc,
            HcQuantity = hc,
            TcQuantity = tc,
            TotalQuantity = hc + tc,
            SubmittedByUserId = account.Id,
            Note = note
        };

    private static async Task LoginAsync(HttpClient client, string identifier, string password)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { identifier, password });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
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
}
