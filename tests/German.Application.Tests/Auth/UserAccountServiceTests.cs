using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Infrastructure.Auth;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Auth;

[TestClass]
public sealed class UserAccountServiceTests
{
    [TestMethod]
    public async Task UpdateAsyncChangesAccountFieldsAndPasswordWhenProvided()
    {
        await using var db = CreateDb();
        var oldEmployee = new Employee { EmployeeCode = "E001", FullName = "Nhân viên cũ" };
        var newEmployee = new Employee { EmployeeCode = "E002", FullName = "Nhân viên mới" };
        var account = new UserAccount { Username = "old-name", NormalizedUsername = "OLD-NAME", EmployeeId = oldEmployee.Id };
        var passwords = new PasswordService();
        account.PasswordHash = passwords.HashPassword(account, "old-secret");
        db.AddRange(oldEmployee, newEmployee, account);
        await db.SaveChangesAsync();

        var result = await new UserAccountService(db, passwords).UpdateAsync(
            account.Id,
            new UpdateUserAccountCommand(" new-name ", "new-secret", UserRole.Manager, newEmployee.Id, false),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        var updated = await db.UserAccounts.SingleAsync();
        Assert.AreEqual("new-name", updated.Username);
        Assert.AreEqual("NEW-NAME", updated.NormalizedUsername);
        Assert.AreEqual(UserRole.Manager, updated.Role);
        Assert.AreEqual(newEmployee.Id, updated.EmployeeId);
        Assert.IsFalse(updated.IsActive);
        Assert.IsTrue(passwords.VerifyPassword(updated, updated.PasswordHash, "new-secret"));
        Assert.IsFalse(passwords.VerifyPassword(updated, updated.PasswordHash, "old-secret"));
        Assert.AreEqual("Nhân viên mới", result.Value?.EmployeeName);
    }

    [TestMethod]
    public async Task UpdateAsyncKeepsPasswordWhenPasswordIsBlank()
    {
        await using var db = CreateDb();
        var account = new UserAccount { Username = "worker", NormalizedUsername = "WORKER" };
        var passwords = new PasswordService();
        account.PasswordHash = passwords.HashPassword(account, "unchanged-secret");
        db.UserAccounts.Add(account);
        await db.SaveChangesAsync();
        var originalHash = account.PasswordHash;

        var result = await new UserAccountService(db, passwords).UpdateAsync(
            account.Id,
            new UpdateUserAccountCommand("worker", "  ", UserRole.Admin, null, true),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        var updated = await db.UserAccounts.SingleAsync();
        Assert.AreEqual(originalHash, updated.PasswordHash);
        Assert.IsTrue(passwords.VerifyPassword(updated, updated.PasswordHash, "unchanged-secret"));
    }

    [TestMethod]
    public async Task DeleteAsyncDeactivatesAccountAndKeepsItInTheDatabase()
    {
        await using var db = CreateDb();
        var account = new UserAccount { Username = "worker", NormalizedUsername = "WORKER", IsActive = true };
        db.UserAccounts.Add(account);
        await db.SaveChangesAsync();

        var result = await new UserAccountService(db, new PasswordService()).DeleteAsync(account.Id, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        var deleted = await db.UserAccounts.SingleAsync();
        Assert.IsFalse(deleted.IsActive);
    }

    [TestMethod]
    public async Task UpdateAsyncRejectsDuplicateUsernameAndMissingWorkerEmployee()
    {
        await using var db = CreateDb();
        var first = new UserAccount { Username = "first", NormalizedUsername = "FIRST" };
        var second = new UserAccount { Username = "second", NormalizedUsername = "SECOND" };
        db.AddRange(first, second);
        await db.SaveChangesAsync();
        var service = new UserAccountService(db, new PasswordService());

        var duplicate = await service.UpdateAsync(
            second.Id,
            new UpdateUserAccountCommand(" first ", null, UserRole.Admin, null, true),
            CancellationToken.None);
        var missingEmployee = await service.UpdateAsync(
            second.Id,
            new UpdateUserAccountCommand("second", null, UserRole.Worker, null, true),
            CancellationToken.None);

        Assert.IsFalse(duplicate.IsSuccess);
        Assert.AreEqual("user_account.duplicate_username", duplicate.Error?.Code);
        Assert.IsFalse(missingEmployee.IsSuccess);
        Assert.AreEqual("user_account.worker_requires_employee", missingEmployee.Error?.Code);
    }

    private static GermanDbContext CreateDb() => new(
        new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
