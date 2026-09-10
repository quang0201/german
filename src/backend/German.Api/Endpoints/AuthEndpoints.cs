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
        group.MapPost("/logout", (Delegate)LogoutAsync).RequireAuthorization();
        group.MapGet("/me", Me).RequireAuthorization();
        group.MapPost("/mcp-session", CreateMcpSessionCode).RequireAuthorization("ManagerOrAdmin");
        group.MapPost("/mcp-session/exchange", ExchangeMcpSessionCode).AllowAnonymous();

        return endpoints;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        AuthService authService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var result = await authService.LoginAsync(request.Identifier, request.Password, cancellationToken);
        if (!result.IsSuccess) return ApiResultMapper.Error(result.Error!);

        await SignInAsync(httpContext, result.Value!);
        return Results.Ok(result.Value);
    }

    private static async Task<IResult> CreateMcpSessionCode(
        ClaimsPrincipal user,
        McpSessionService service,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var userIdText = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdText, out var userId)) return Results.Unauthorized();

        var result = await service.CreateAsync(userId, cancellationToken);
        if (!result.IsSuccess) return ApiResultMapper.Error(result.Error!);
        httpContext.Response.Headers.CacheControl = "no-store";
        return Results.Ok(result.Value);
    }

    private static async Task<IResult> ExchangeMcpSessionCode(
        McpSessionCodeExchangeRequest request,
        McpSessionService service,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var result = await service.ExchangeAsync(request.Code, cancellationToken);
        if (!result.IsSuccess) return Results.Unauthorized();

        await SignInAsync(httpContext, result.Value!);
        httpContext.Response.Headers.CacheControl = "no-store";
        return Results.Ok(result.Value);
    }

    private static async Task SignInAsync(HttpContext httpContext, AuthSessionDto session)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, session.UserId.ToString()),
            new(ClaimTypes.Name, session.Username),
            new(ClaimTypes.Role, session.Role.ToString())
        };
        if (session.EmployeeId.HasValue) claims.Add(new Claim("employee_id", session.EmployeeId.Value.ToString()));

        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)),
            new AuthenticationProperties { IsPersistent = false });
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
