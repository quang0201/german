using German.Domain.Auth;

namespace German.Api.Contracts.Auth;

public sealed record UpdateUserAccountRequest(
    string Username,
    string? Password,
    UserRole Role,
    Guid? EmployeeId,
    bool IsActive);
