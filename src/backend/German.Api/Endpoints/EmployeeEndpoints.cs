using German.Api.Contracts.Employees;
using German.Application.Employees;

namespace German.Api.Endpoints;

public static class EmployeeEndpoints
{
    public static IEndpointRouteBuilder MapEmployeeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/employees").RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/", async (EmployeeService service, CancellationToken ct) => Results.Ok(await service.ListAsync(ct)));
        group.MapPost("/", async (CreateEmployeeRequest request, EmployeeService service, CancellationToken ct) =>
        {
            var result = await service.CreateAsync(new CreateEmployeeCommand(request.EmployeeCode, request.FullName), ct);
            return result.IsSuccess ? Results.Created($"/api/employees/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPut("/{id:guid}", async (Guid id, UpdateEmployeeRequest request, EmployeeService service, CancellationToken ct) =>
        {
            var result = await service.UpdateAsync(id, new UpdateEmployeeCommand(request.EmployeeCode, request.FullName, request.IsActive), ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });
        group.MapPost("/{id:guid}/shift-assignments", async (Guid id, AssignShiftRequest request, EmployeeService service, CancellationToken ct) =>
        {
            var result = await service.AssignShiftAsync(id, new AssignShiftCommand(request.ShiftTemplateId, request.EffectiveFrom), ct);
            return result.IsSuccess ? Results.Created($"/api/employees/{id}/shift-assignments/{result.Value!.Id}", result.Value) : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }
}
