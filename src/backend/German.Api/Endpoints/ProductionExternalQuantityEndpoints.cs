using German.Api.Auth;
using German.Api.Contracts.ProductionOrders;
using German.Application.ProductionOrders;

namespace German.Api.Endpoints;

public static class ProductionExternalQuantityEndpoints
{
    public static IEndpointRouteBuilder MapProductionExternalQuantityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/production-external-quantities")
            .RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/summary", async (
            Guid orderId,
            Guid? operationId,
            DateOnly? fromDate,
            DateOnly? untilDate,
            ProductionExternalQuantityService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.SummarizeAsync(orderId, operationId, fromDate, untilDate, cancellationToken);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });

        group.MapGet("/", async (
            Guid orderId,
            Guid? operationId,
            DateOnly? fromDate,
            DateOnly? untilDate,
            ProductionExternalQuantityService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListAsync(orderId, operationId, fromDate, untilDate, cancellationToken);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });

        group.MapPost("/", async (
            CreateProductionExternalQuantityRequest request,
            HttpContext httpContext,
            ProductionExternalQuantityService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateAsync(
                httpContext.User.ToCurrentActor(),
                new CreateProductionExternalQuantityCommand(
                    request.ProductionOrderId,
                    request.ProductionOperationId,
                    request.ReceivedDate,
                    request.Quantity,
                    request.SourceName,
                    request.Note),
                cancellationToken);
            return result.IsSuccess
                ? Results.Created($"/api/production-external-quantities/{result.Value!.Id}", result.Value)
                : ApiResultMapper.Error(result.Error!);
        });

        group.MapPut("/{id:guid}", async (
            Guid id,
            UpdateProductionExternalQuantityRequest request,
            HttpContext httpContext,
            ProductionExternalQuantityService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateAsync(
                httpContext.User.ToCurrentActor(),
                id,
                new UpdateProductionExternalQuantityCommand(request.ReceivedDate, request.Quantity, request.SourceName, request.Note),
                cancellationToken);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });

        group.MapDelete("/{id:guid}", async (
            Guid id,
            HttpContext httpContext,
            ProductionExternalQuantityService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.DeleteAsync(httpContext.User.ToCurrentActor(), id, cancellationToken);
            return result.IsSuccess ? Results.NoContent() : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }
}
