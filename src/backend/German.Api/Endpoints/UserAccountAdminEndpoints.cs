using German.Api.Contracts.Auth;
using German.Application.Auth;

namespace German.Api.Endpoints;

public static class UserAccountAdminEndpoints
{
    public static IEndpointRouteBuilder MapUserAccountAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/user-accounts").RequireAuthorization("AdminOnly");

        group.MapGet("/", async (UserAccountService service, CancellationToken ct) =>
            Results.Ok(await service.ListAsync(ct)));

        group.MapPost("/", async (
            CreateUserAccountRequest request,
            UserAccountService service,
            CancellationToken ct) =>
        {
            var result = await service.CreateAsync(
                new CreateUserAccountCommand(request.Username, request.Password, request.Role, request.EmployeeId),
                ct);
            return result.IsSuccess
                ? Results.Created($"/api/admin/user-accounts/{result.Value!.Id}", result.Value)
                : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }
}
