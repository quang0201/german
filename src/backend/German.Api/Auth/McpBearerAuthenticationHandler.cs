using System.Security.Claims;
using System.Text.Encodings.Web;
using German.Application.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace German.Api.Auth;

public sealed class McpBearerAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    McpSessionService sessionService)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var values))
        {
            return AuthenticateResult.NoResult();
        }

        var authorization = values.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.NoResult();
        }

        var token = authorization["Bearer ".Length..].Trim();
        if (token.Length == 0)
        {
            return AuthenticateResult.Fail("Invalid MCP bearer token.");
        }

        var session = await sessionService.ExchangeTokenAsync(token, Context.RequestAborted);
        if (!session.IsSuccess || session.Value is null)
        {
            return AuthenticateResult.Fail("Invalid MCP bearer token.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, session.Value.UserId.ToString()),
            new(ClaimTypes.Name, session.Value.Username),
            new(ClaimTypes.Role, session.Value.Role.ToString())
        };
        if (session.Value.EmployeeId.HasValue)
        {
            claims.Add(new Claim("employee_id", session.Value.EmployeeId.Value.ToString()));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.Headers.WWWAuthenticate = "Bearer";
        return Task.CompletedTask;
    }

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }
}
