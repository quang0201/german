using German.Infrastructure.Auth;
using German.Infrastructure.Bootstrap;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Bootstrap;

[TestClass]
public sealed class BootstrapAdminSeederTests
{
    [TestMethod]
    public async Task EnabledBootstrap_CreatesSingleAdminAccount()
    {
        await using var db = CreateDbContext();
        var seeder = new BootstrapAdminSeeder(db, new PasswordService());
        var options = new BootstrapAdminOptions
        {
            Enabled = true,
            Username = "admin",
            Password = "change-me-now"
        };

        await seeder.SeedAsync(options, CancellationToken.None);
        await seeder.SeedAsync(options, CancellationToken.None);

        var accounts = await db.UserAccounts.ToListAsync();
        Assert.AreEqual(1, accounts.Count);
        Assert.AreEqual("admin", accounts[0].Username);
        Assert.AreEqual(German.Domain.Auth.UserRole.Admin, accounts[0].Role);
        Assert.IsNull(accounts[0].EmployeeId);
    }

    [TestMethod]
    public async Task DisabledBootstrap_DoesNothing()
    {
        await using var db = CreateDbContext();
        var seeder = new BootstrapAdminSeeder(db, new PasswordService());

        await seeder.SeedAsync(new BootstrapAdminOptions { Enabled = false }, CancellationToken.None);

        Assert.AreEqual(0, await db.UserAccounts.CountAsync());
    }

    private static GermanDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new GermanDbContext(options);
    }
}
