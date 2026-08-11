using System.Security.Claims;
using German.Api.Contracts.Auth;
using German.Application.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace German.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth");

        group.MapPost("/login", LoginAsync).AllowAnonymous();
        group.MapPost("/logout", LogoutAsync).RequireAuthorization();
        group.MapGet("/me", Me).RequireAuthorization();

        return endpoints;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        AuthService authService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var result = await authService.LoginAsync(request.Identifier, request.Password, cancellationToken);
        if (!result.IsSuccess)
        {
            return ApiResultMapper.Error(result.Error!);
        }

        var session = result.Value!;
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, session.UserId.ToString()),
            new(ClaimTypes.Name, session.Username),
            new(ClaimTypes.Role, session.Role.ToString())
        };
        if (session.EmployeeId.HasValue)
        {
            claims.Add(new Claim("employee_id", session.EmployeeId.Value.ToString()));
        }

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties { IsPersistent = false });

        return Results.Ok(session);
    }

    private static async Task<IResult> LogoutAsync(HttpContext httpContext)
    {
        await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    private static IResult Me(ClaimsPrincipal user)
    {
        var employeeIdText = user.FindFirstValue("employee_id");
        return Results.Ok(new
        {
            userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!),
            username = user.Identity!.Name,
            role = user.FindFirstValue(ClaimTypes.Role),
            employeeId = Guid.TryParse(employeeIdText, out var employeeId) ? employeeId : (Guid?)null
        });
    }
}
