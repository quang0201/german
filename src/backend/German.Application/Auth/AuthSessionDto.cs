using German.Domain.Auth;

namespace German.Application.Auth;

public sealed record AuthSessionDto(
    Guid UserId,
    string Username,
    UserRole Role,
    Guid? EmployeeId,
    string? EmployeeCode,
    string? FullName);
