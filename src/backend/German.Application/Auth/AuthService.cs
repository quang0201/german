using German.Application.Abstractions;
using German.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Auth;

public sealed class AuthService(IGermanDbContext db, IPasswordService passwordService)
{
    public async Task<AppResult<AuthSessionDto>> LoginAsync(
        string identifier,
        string password,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrEmpty(password))
        {
            return InvalidCredentials();
        }

        var normalized = identifier.Trim().ToUpperInvariant();
        var account = await db.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.NormalizedUsername == normalized, cancellationToken);

        if (account is null)
        {
            var employee = await db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EmployeeCode.ToUpper() == normalized, cancellationToken);

            if (employee is not null)
            {
                account = await db.UserAccounts.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.EmployeeId == employee.Id, cancellationToken);
            }
        }

        if (account is null || !account.IsActive ||
            !passwordService.VerifyPassword(account, account.PasswordHash, password))
        {
            return InvalidCredentials();
        }

        string? employeeCode = null;
        string? fullName = null;
        if (account.EmployeeId.HasValue)
        {
            var employee = await db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == account.EmployeeId.Value, cancellationToken);
            if (employee is null || !employee.IsActive)
            {
                return InvalidCredentials();
            }

            employeeCode = employee.EmployeeCode;
            fullName = employee.FullName;
        }

        return AppResult<AuthSessionDto>.Success(new AuthSessionDto(
            account.Id,
            account.Username,
            account.Role,
            account.EmployeeId,
            employeeCode,
            fullName));
    }

    private static AppResult<AuthSessionDto> InvalidCredentials() =>
        AppResult<AuthSessionDto>.Failure(
            "auth.invalid_credentials",
            "Tên đăng nhập, mã nhân viên hoặc mật khẩu không đúng.");
}
