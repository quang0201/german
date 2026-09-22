using German.Api.Contracts.ProductionOrders;
using German.Api.Caching;
using German.Application.ProductionOrders;

namespace German.Api.Endpoints;

public static class ProductionOrderAdminEndpoints
{
    public static IEndpointRouteBuilder MapProductionOrderAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/production-orders").RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/", async (ProductionOrderService service, CancellationToken ct) => Results.Ok(await service.ListAsync(ct)));
        group.MapGet("/{id:guid}", async (Guid id, ProductionOrderService service, CancellationToken ct) =>
        {
            var result = await service.GetAsync(id, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPost("/", async (CreateProductionOrderRequest request, ProductionOrderService service, LookupCache cache, CancellationToken ct) =>
        {
            var command = new CreateProductionOrderCommand(
                request.Code,
                request.ProductName,
                request.PlannedQuantity,
                request.Status,
                request.StartDate,
                request.EndDate,
                request.CloneFromOrderId,
                request.Operations?.Select(ToInput).ToList());
            var result = await service.CreateAsync(command, ct);
            if (result.IsSuccess) cache.InvalidateActiveProductionOrders();
            return result.IsSuccess ? Results.Created($"/api/production-orders/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPut("/{id:guid}", async (Guid id, UpdateProductionOrderRequest request, ProductionOrderService service, LookupCache cache, CancellationToken ct) =>
        {
            var command = new UpdateProductionOrderCommand(request.Code, request.ProductName, request.PlannedQuantity, request.Status, request.StartDate, request.EndDate);
            var result = await service.UpdateAsync(id, command, ct);
            if (result.IsSuccess)
            {
                cache.InvalidateActiveProductionOrders();
                cache.InvalidateOperations(id);
            }
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPost("/{orderId:guid}/operations", async (Guid orderId, ProductionOperationRequest request, ProductionOrderService service, LookupCache cache, CancellationToken ct) =>
        {
            var result = await service.AddOperationAsync(orderId, ToInput(request), ct);
            if (result.IsSuccess) cache.InvalidateOperations(orderId);
            return result.IsSuccess ? Results.Created($"/api/production-orders/{orderId}/operations/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPut("/{orderId:guid}/operations/{operationId:guid}", async (Guid orderId, Guid operationId, ProductionOperationRequest request, ProductionOrderService service, LookupCache cache, CancellationToken ct) =>
        {
            var result = await service.UpdateOperationAsync(orderId, operationId, ToInput(request), ct);
            if (result.IsSuccess) cache.InvalidateOperations(orderId);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPost("/0417/operations/567/cleanup", async (ProductionOrderService service, LookupCache cache, CancellationToken ct) =>
        {
            var result = await service.Cleanup0417Operation567Async(ct);
            if (result.IsSuccess) cache.InvalidateAll();
            return result.IsSuccess ? Results.NoContent() : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }

    private static ProductionOperationInput ToInput(ProductionOperationRequest request) =>
        new(request.OperationNumber, request.Name, request.Unit, request.SortOrder, request.IsActive, request.FixedPrice);
}
