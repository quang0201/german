using German.Api.Auth;
using German.Api.Contracts.ProductionEntries;
using German.Application.Common;
using German.Application.ProductionEntries;

namespace German.Api.Endpoints;

public static class ProductionEntryEndpoints
{
    public static IEndpointRouteBuilder MapProductionEntryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/production-entries").RequireAuthorization();
        group.MapGet("/", ListAsync).RequireAuthorization("ManagerOrAdmin");
        group.MapGet("/monthly-matrix", GetMonthlyMatrixAsync).RequireAuthorization("ManagerOrAdmin");
        group.MapGet("/mine", ListMineAsync);
        group.MapGet("/{id:guid}", GetDetailAsync);
        group.MapPost("/", CreateAsync);
        group.MapPost("/batch-direct", CreateBatchDirectAsync).RequireAuthorization("ManagerOrAdmin");
        group.MapPut("/{id:guid}", UpdateAsync).RequireAuthorization("ManagerOrAdmin");
        group.MapDelete("/{id:guid}", DeleteAsync).RequireAuthorization("ManagerOrAdmin");
        return endpoints;
    }

    private static async Task<IResult> ListAsync(DateOnly? date, DateOnly? fromDate, DateOnly? untilDate, Guid? employeeId, Guid? orderId, Guid? operationId, string? search, int? page, int? pageSize, ProductionEntryQueryService service, CancellationToken cancellationToken)
    {
        var result = await service.ListAsync(new ProductionEntryListQuery(date, fromDate, untilDate, employeeId, orderId, operationId, search, page, pageSize), cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> GetMonthlyMatrixAsync(int year, int month, Guid? employeeId, Guid? orderId, Guid? operationId, string? search, bool? excludeSundays, ProductionMonthlyMatrixService service, CancellationToken cancellationToken)
    {
        var result = await service.GetAsync(new ProductionMonthlyMatrixQuery(year, month, employeeId, orderId, operationId, search, excludeSundays ?? true), cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> ListMineAsync(DateOnly? date, DateOnly? fromDate, DateOnly? untilDate, string? search, int? page, int? pageSize, HttpContext httpContext, ProductionEntryQueryService service, CancellationToken cancellationToken)
    {
        var result = await service.ListMineAsync(httpContext.User.ToCurrentActor(), new ProductionEntryListQuery(date, fromDate, untilDate, null, null, null, search, page, pageSize), cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> GetDetailAsync(Guid id, HttpContext httpContext, ProductionEntryQueryService service, CancellationToken cancellationToken)
    {
        var result = await service.GetDetailAsync(httpContext.User.ToCurrentActor(), id, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> CreateAsync(CreateProductionEntryRequest request, HttpContext httpContext, ProductionEntryService service, CancellationToken cancellationToken)
    {
        var result = await service.CreateAsync(httpContext.User.ToCurrentActor(), new CreateProductionEntryCommand(request.WorkDate, request.EmployeeId, request.ProductionOrderId, request.ProductionOperationId, request.EntryMode, request.Shift1Quantity, request.Shift2Quantity, request.DirectHcQuantity, request.DirectTcQuantity, request.TotalInputQuantity, request.OvertimeHours, request.OvertimeQuantity, request.WorkStart, request.WorkEnd, request.Note, request.ExpectedEmpty), cancellationToken);
        return result.IsSuccess ? Results.Created($"/api/production-entries/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> CreateBatchDirectAsync(CreateProductionEntryBatchDirectRequest request, HttpContext httpContext, ProductionEntryBatchDirectService service, CancellationToken cancellationToken)
    {
        var requestItems = request.Items ?? Array.Empty<CreateProductionEntryBatchDirectItemRequest>();
        var items = requestItems.Select(item => new CreateProductionEntryBatchDirectItem(item.ProductionOperationId, item.DirectHcQuantity, item.DirectTcQuantity, item.Note)).ToArray();
        var command = new CreateProductionEntryBatchDirectCommand(request.WorkDate, request.EmployeeId, request.ProductionOrderId, items);
        var result = await service.CreateAsync(httpContext.User.ToCurrentActor(), command, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> UpdateAsync(Guid id, UpdateProductionEntryRequest request, HttpContext httpContext, ProductionEntryService service, CancellationToken cancellationToken)
    {
        var result = await service.UpdateAsync(httpContext.User.ToCurrentActor(), id, request.Version, new UpdateProductionEntryCommand(request.WorkDate, request.EmployeeId, request.ProductionOrderId, request.ProductionOperationId, request.EntryMode, request.Shift1Quantity, request.Shift2Quantity, request.DirectHcQuantity, request.DirectTcQuantity, request.TotalInputQuantity, request.OvertimeHours, request.OvertimeQuantity, request.WorkStart, request.WorkEnd, request.Note), cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> DeleteAsync(Guid id, int version, HttpContext httpContext, ProductionEntryService service, CancellationToken cancellationToken)
    {
        var result = await service.DeleteAsync(httpContext.User.ToCurrentActor(), id, version, cancellationToken);
        return result.IsSuccess ? Results.NoContent() : ApiResultMapper.Error(result.Error!);
    }
}
