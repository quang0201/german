using German.Application.Auth;
using German.Domain.Auth;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace German.Infrastructure.Bootstrap;

public sealed class BootstrapAdminSeeder(GermanDbContext db, IPasswordService passwordService)
{
    public async Task SeedAsync(BootstrapAdminOptions options, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (!options.Enabled)
        {
            return;
        }

        if (await db.UserAccounts.AnyAsync(cancellationToken))
        {
            return;
        }

        var username = options.Username?.Trim() ?? string.Empty;
        if (username.Length == 0 || string.IsNullOrWhiteSpace(options.Password) || options.Password.Length < 8)
        {
            throw new InvalidOperationException(
                "Bootstrap Admin is enabled but Username is empty or Password has fewer than 8 characters.");
        }

        var account = new UserAccount
        {
            Username = username,
            NormalizedUsername = username.ToUpperInvariant(),
            Role = UserRole.Admin,
            IsActive = true
        };
        account.PasswordHash = passwordService.HashPassword(account, options.Password);

        db.UserAccounts.Add(account);
        await db.SaveChangesAsync(cancellationToken);
    }
}
