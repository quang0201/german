using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Employees;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Auth;

public sealed class UserAccountService(IGermanDbContext db, IPasswordService passwordService)
{
    public async Task<IReadOnlyList<UserAccountDto>> ListAsync(CancellationToken cancellationToken)
    {
        var accounts = await db.UserAccounts.AsNoTracking()
            .OrderBy(x => x.Username)
            .ToListAsync(cancellationToken);

        var employeeIds = accounts
            .Where(x => x.EmployeeId.HasValue)
            .Select(x => x.EmployeeId!.Value)
            .Distinct()
            .ToArray();
        var employees = await db.Employees.AsNoTracking()
            .Where(x => employeeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        return accounts.Select(account =>
        {
            Employee? employee = null;
            if (account.EmployeeId.HasValue)
            {
                employees.TryGetValue(account.EmployeeId.Value, out employee);
            }

            return ToDto(account, employee);
        }).ToList();
    }

    public async Task<AppResult<UserAccountDto>> CreateAsync(
        CreateUserAccountCommand command,
        CancellationToken cancellationToken)
    {
        var username = command.Username?.Trim() ?? string.Empty;
        var normalizedUsername = username.ToUpperInvariant();
        if (username.Length == 0 || string.IsNullOrWhiteSpace(command.Password) || command.Password.Length < 8)
        {
            return AppResult<UserAccountDto>.Failure(
                "user_account.invalid_input",
                "Tên đăng nhập là bắt buộc và mật khẩu phải có ít nhất 8 ký tự.");
        }

        if (await db.UserAccounts.AnyAsync(x => x.NormalizedUsername == normalizedUsername, cancellationToken))
        {
            return AppResult<UserAccountDto>.Failure(
                "user_account.duplicate_username",
                "Tên đăng nhập đã tồn tại.");
        }

        if (command.Role == UserRole.Worker && !command.EmployeeId.HasValue)
        {
            return AppResult<UserAccountDto>.Failure(
                "user_account.worker_requires_employee",
                "Tài khoản công nhân phải gắn với một nhân viên.");
        }

        Employee? employee = null;
        if (command.EmployeeId.HasValue)
        {
            employee = await db.Employees.FirstOrDefaultAsync(
                x => x.Id == command.EmployeeId.Value && x.IsActive,
                cancellationToken);
            if (employee is null)
            {
                return AppResult<UserAccountDto>.Failure(
                    "user_account.employee_not_found",
                    "Không tìm thấy nhân viên đang hoạt động.");
            }

            if (await db.UserAccounts.AnyAsync(x => x.EmployeeId == employee.Id, cancellationToken))
            {
                return AppResult<UserAccountDto>.Failure(
                    "user_account.employee_already_linked",
                    "Nhân viên đã được gắn với một tài khoản khác.");
            }
        }

        var account = new UserAccount
        {
            Username = username,
            NormalizedUsername = normalizedUsername,
            Role = command.Role,
            EmployeeId = command.EmployeeId,
            IsActive = true
        };
        account.PasswordHash = passwordService.HashPassword(account, command.Password);

        db.UserAccounts.Add(account);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<UserAccountDto>.Success(ToDto(account, employee));
    }

    private static UserAccountDto ToDto(UserAccount account, Employee? employee) =>
        new(
            account.Id,
            account.Username,
            account.Role,
            account.IsActive,
            account.EmployeeId,
            employee?.EmployeeCode,
            employee?.FullName,
            account.CreatedAt);
}
