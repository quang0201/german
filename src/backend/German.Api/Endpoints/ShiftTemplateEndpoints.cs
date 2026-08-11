using German.Api.Contracts.Shifts;
using German.Application.Shifts;

namespace German.Api.Endpoints;

public static class ShiftTemplateEndpoints
{
    public static IEndpointRouteBuilder MapShiftTemplateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/shift-templates").RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/", async (ShiftTemplateService service, CancellationToken ct) => Results.Ok(await service.ListAsync(ct)));
        group.MapPost("/", async (CreateShiftTemplateRequest request, ShiftTemplateService service, CancellationToken ct) =>
        {
            var command = new CreateShiftTemplateCommand(request.Name, request.Periods.Select(ToInput).ToList());
            var result = await service.CreateAsync(command, ct);
            return result.IsSuccess ? Results.Created($"/api/shift-templates/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPut("/{id:guid}", async (Guid id, UpdateShiftTemplateRequest request, ShiftTemplateService service, CancellationToken ct) =>
        {
            var command = new UpdateShiftTemplateCommand(request.Name, request.IsActive, request.Periods.Select(ToInput).ToList());
            var result = await service.UpdateAsync(id, command, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }

    private static ShiftPeriodInput ToInput(ShiftPeriodRequest request) =>
        new(request.Name, request.StartTime, request.EndTime, request.SortOrder);
}
