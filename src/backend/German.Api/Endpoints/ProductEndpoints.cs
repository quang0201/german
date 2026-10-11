using German.Api.Contracts.Products;
using German.Application.ProductionOrders;
using German.Application.Products;

namespace German.Api.Endpoints;

public static class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/products").RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/", async (ProductService service, CancellationToken ct) => Results.Ok(await service.ListAsync(ct)));
        group.MapGet("/{id:guid}", async (Guid id, ProductService service, CancellationToken ct) =>
        {
            var result = await service.GetAsync(id, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPost("/", async (SaveProductRequest request, ProductService service, CancellationToken ct) =>
        {
            var result = await service.CreateAsync(ToCommand(request), ct);
            return result.IsSuccess ? Results.Created($"/api/products/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPut("/{id:guid}", async (Guid id, SaveProductRequest request, ProductService service, CancellationToken ct) =>
        {
            var result = await service.UpdateAsync(id, ToCommand(request), ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapDelete("/{id:guid}", async (Guid id, ProductService service, CancellationToken ct) =>
        {
            var result = await service.DisableAsync(id, ct);
            return result.IsSuccess ? Results.NoContent() : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }

    private static SaveProductCommand ToCommand(SaveProductRequest request) =>
        new(request.Code, request.Name, request.IsActive,
            (request.Operations ?? []).Select(x => new ProductionOperationInput(x.OperationNumber, x.Name, x.Unit, x.SortOrder, x.IsActive, x.FixedPrice)).ToList());
}
