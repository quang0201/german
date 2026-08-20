using German.Api.Auth;
using German.Application.Attendance;
using German.Application.Lookups;
using German.Domain.Auth;

namespace German.Api.Endpoints;

public static class LookupEndpoints
{
    public static IEndpointRouteBuilder MapLookupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/lookups/production-orders/active", async (
            LookupService service,
            CancellationToken ct) =>
        {
            var orders = await service.ListActiveProductionOrdersAsync(ct);
            return Results.Ok(orders);
        }).RequireAuthorization();

        endpoints.MapGet("/api/production-orders/{orderId:guid}/operations", async (
            Guid orderId,
            LookupService service,
            CancellationToken ct) =>
        {
            var operations = await service.ListActiveOperationsAsync(orderId, ct);
            return Results.Ok(operations);
        }).RequireAuthorization();

        endpoints.MapGet("/api/lookups/hc-hours", async (
            Guid employeeId,
            DateOnly date,
            HttpContext context,
            LookupService service,
            CancellationToken ct) =>
        {
            var actor = context.User.ToCurrentActor();
            var result = await service.GetHcHoursAsync(actor, employeeId, date, ct);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : ApiResultMapper.Error(result.Error!);
        }).RequireAuthorization();

        endpoints.MapGet("/api/lookups/attendance-hours", async (
            Guid employeeId,
            DateOnly date,
            HttpContext context,
            AttendanceHoursQueryService service,
            CancellationToken ct) =>
        {
            var actor = context.User.ToCurrentActor();
            if (actor.Role == UserRole.Worker && actor.EmployeeId != employeeId)
            {
                return Results.Forbid();
            }

            return Results.Ok(await service.GetAsync(employeeId, date, ct));
        }).RequireAuthorization();

        return endpoints;
    }
}
