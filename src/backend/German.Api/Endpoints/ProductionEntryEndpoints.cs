using German.Api.Auth;
using German.Api.Contracts.ProductionEntries;
using German.Application.ProductionEntries;

namespace German.Api.Endpoints;

public static class ProductionEntryEndpoints
{
    public static IEndpointRouteBuilder MapProductionEntryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/production-entries").RequireAuthorization();

        group.MapGet("/", ListAsync).RequireAuthorization("ManagerOrAdmin");
        group.MapPost("/", CreateAsync);
        group.MapPut("/{id:guid}", UpdateAsync).RequireAuthorization("ManagerOrAdmin");
        group.MapDelete("/{id:guid}", DeleteAsync).RequireAuthorization("ManagerOrAdmin");

        return endpoints;
    }

    private static async Task<IResult> ListAsync(
        DateOnly? date,
        Guid? employeeId,
        Guid? orderId,
        Guid? operationId,
        ProductionEntryQueryService service,
        CancellationToken cancellationToken)
    {
        var rows = await service.ListAsync(date, employeeId, orderId, operationId, cancellationToken);
        return Results.Ok(rows);
    }

    private static async Task<IResult> CreateAsync(
        CreateProductionEntryRequest request,
        HttpContext httpContext,
        ProductionEntryService service,
        CancellationToken cancellationToken)
    {
        var actor = httpContext.User.ToCurrentActor();
        var result = await service.CreateAsync(actor, new CreateProductionEntryCommand(
            request.WorkDate,
            request.EmployeeId,
            request.ProductionOrderId,
            request.ProductionOperationId,
            request.EntryMode,
            request.Shift1Quantity,
            request.Shift2Quantity,
            request.DirectHcQuantity,
            request.DirectTcQuantity,
            request.TotalInputQuantity,
            request.OvertimeHours,
            request.OvertimeQuantity,
            request.WorkStart,
            request.WorkEnd,
            request.Note), cancellationToken);

        return result.IsSuccess
            ? Results.Created($"/api/production-entries/{result.Value!.Id}", result.Value)
            : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> UpdateAsync(
        Guid id,
        UpdateProductionEntryRequest request,
        HttpContext httpContext,
        ProductionEntryService service,
        CancellationToken cancellationToken)
    {
        var actor = httpContext.User.ToCurrentActor();
        var result = await service.UpdateAsync(actor, id, request.Version, new UpdateProductionEntryCommand(
            request.WorkDate,
            request.EmployeeId,
            request.ProductionOrderId,
            request.ProductionOperationId,
            request.EntryMode,
            request.Shift1Quantity,
            request.Shift2Quantity,
            request.DirectHcQuantity,
            request.DirectTcQuantity,
            request.TotalInputQuantity,
            request.OvertimeHours,
            request.OvertimeQuantity,
            request.WorkStart,
            request.WorkEnd,
            request.Note), cancellationToken);

        return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> DeleteAsync(
        Guid id,
        int version,
        HttpContext httpContext,
        ProductionEntryService service,
        CancellationToken cancellationToken)
    {
        var actor = httpContext.User.ToCurrentActor();
        var result = await service.DeleteAsync(actor, id, version, cancellationToken);
        return result.IsSuccess ? Results.NoContent() : ApiResultMapper.Error(result.Error!);
    }
}
