using German.Application.Auth;
using German.Domain.Auth;
using Microsoft.AspNetCore.Identity;

namespace German.Infrastructure.Auth;

public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<UserAccount> _hasher = new();

    public string HashPassword(UserAccount account, string password)
    {
        ArgumentNullException.ThrowIfNull(account);
        ArgumentException.ThrowIfNullOrEmpty(password);
        return _hasher.HashPassword(account, password);
    }

    public bool VerifyPassword(UserAccount account, string passwordHash, string providedPassword)
    {
        ArgumentNullException.ThrowIfNull(account);
        if (string.IsNullOrEmpty(passwordHash) || string.IsNullOrEmpty(providedPassword))
        {
            return false;
        }

        return _hasher.VerifyHashedPassword(account, passwordHash, providedPassword)
            != PasswordVerificationResult.Failed;
    }
}
