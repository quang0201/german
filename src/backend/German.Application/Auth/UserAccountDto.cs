using German.Domain.Auth;

namespace German.Application.Auth;

public sealed record CreateUserAccountCommand(
    string Username,
    string Password,
    UserRole Role,
    Guid? EmployeeId);

public sealed record UserAccountDto(
    Guid Id,
    string Username,
    UserRole Role,
    bool IsActive,
    Guid? EmployeeId,
    string? EmployeeCode,
    string? EmployeeName,
    DateTimeOffset CreatedAt);
