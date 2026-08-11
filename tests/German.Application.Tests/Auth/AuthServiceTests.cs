using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Infrastructure.Auth;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Auth;

[TestClass]
public sealed class AuthServiceTests
{
    [TestMethod]
    public async Task Login_WithUsername_ReturnsAccount()
    {
        await using var db = CreateDbContext();
        var passwordService = new PasswordService();
        var employee = new Employee { EmployeeCode = "E001", FullName = "Bạch Thị Đào" };
        var account = new UserAccount
        {
            Username = "dao",
            NormalizedUsername = "DAO",
            Role = UserRole.Worker,
            EmployeeId = employee.Id
        };
        account.PasswordHash = passwordService.HashPassword(account, "secret123");
        db.AddRange(employee, account);
        await db.SaveChangesAsync();

        var service = new AuthService(db, passwordService);
        var result = await service.LoginAsync("dao", "secret123", CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(account.Id, result.Value?.UserId);
        Assert.AreEqual(employee.Id, result.Value?.EmployeeId);
        Assert.AreEqual(UserRole.Worker, result.Value?.Role);
    }

    [TestMethod]
    public async Task Login_WithEmployeeCode_ReturnsLinkedAccount()
    {
        await using var db = CreateDbContext();
        var passwordService = new PasswordService();
        var employee = new Employee { EmployeeCode = "E002", FullName = "Hà Thị Quỳnh" };
        var account = new UserAccount
        {
            Username = "quynh",
            NormalizedUsername = "QUYNH",
            Role = UserRole.Worker,
            EmployeeId = employee.Id
        };
        account.PasswordHash = passwordService.HashPassword(account, "secret456");
        db.AddRange(employee, account);
        await db.SaveChangesAsync();

        var service = new AuthService(db, passwordService);
        var result = await service.LoginAsync("e002", "secret456", CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        Assert.AreEqual(account.Id, result.Value?.UserId);
    }

    [TestMethod]
    public async Task Login_WithWrongPassword_Fails()
    {
        await using var db = CreateDbContext();
        var passwordService = new PasswordService();
        var account = new UserAccount
        {
            Username = "manager",
            NormalizedUsername = "MANAGER",
            Role = UserRole.Manager
        };
        account.PasswordHash = passwordService.HashPassword(account, "correct-password");
        db.Add(account);
        await db.SaveChangesAsync();

        var service = new AuthService(db, passwordService);
        var result = await service.LoginAsync("manager", "wrong-password", CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("auth.invalid_credentials", result.Error?.Code);
    }

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
