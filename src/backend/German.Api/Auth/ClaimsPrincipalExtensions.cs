using System.Security.Claims;
using German.Application.Common;
using German.Domain.Auth;

namespace German.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static CurrentActor ToCurrentActor(this ClaimsPrincipal principal)
    {
        var userIdText = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user is missing user id claim.");
        var roleText = principal.FindFirstValue(ClaimTypes.Role)
            ?? throw new InvalidOperationException("Authenticated user is missing role claim.");

        var employeeText = principal.FindFirstValue("employee_id");
        return new CurrentActor(
            Guid.Parse(userIdText),
            Enum.Parse<UserRole>(roleText, ignoreCase: true),
            Guid.TryParse(employeeText, out var employeeId) ? employeeId : null);
    }
}
