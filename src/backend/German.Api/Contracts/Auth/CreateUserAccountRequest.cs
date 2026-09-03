using German.Domain.Auth;

namespace German.Api.Contracts.Auth;

public sealed record CreateUserAccountRequest(
    string Username,
    string Password,
    UserRole Role,
    Guid? EmployeeId);
