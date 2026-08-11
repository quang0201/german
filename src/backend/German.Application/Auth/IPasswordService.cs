using German.Domain.Auth;

namespace German.Application.Auth;

public interface IPasswordService
{
    string HashPassword(UserAccount account, string password);
    bool VerifyPassword(UserAccount account, string passwordHash, string providedPassword);
}
