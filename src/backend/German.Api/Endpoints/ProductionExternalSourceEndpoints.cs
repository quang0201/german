using German.Api.Auth;
using German.Api.Contracts.ProductionOrders;
using German.Application.ProductionOrders;

namespace German.Api.Endpoints;

public static class ProductionExternalSourceEndpoints
{
    public static IEndpointRouteBuilder MapProductionExternalSourceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/production-external-sources")
            .RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/", async (bool? includeInactive, ProductionExternalSourceService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListAsync(includeInactive == true, cancellationToken)));

        group.MapPost("/", async (CreateProductionExternalSourceRequest request, HttpContext httpContext, ProductionExternalSourceService service, CancellationToken cancellationToken) =>
        {
            var result = await service.CreateAsync(httpContext.User.ToCurrentActor(), new CreateProductionExternalSourceCommand(request.Name), cancellationToken);
            return result.IsSuccess ? Results.Created($"/api/production-external-sources/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateProductionExternalSourceRequest request, HttpContext httpContext, ProductionExternalSourceService service, CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateAsync(httpContext.User.ToCurrentActor(), id, new UpdateProductionExternalSourceCommand(request.Name, request.IsActive), cancellationToken);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }
}
