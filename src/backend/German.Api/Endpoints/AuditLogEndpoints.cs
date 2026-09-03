using German.Application.Auditing;

namespace German.Api.Endpoints;

public static class AuditLogEndpoints
{
    public static IEndpointRouteBuilder MapAuditLogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/audit-logs")
            .RequireAuthorization("AdminOnly");

        group.MapGet("/", ListAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(
        DateOnly? fromDate,
        DateOnly? untilDate,
        string? entityType,
        Guid? entityId,
        German.Domain.Auditing.AuditAction? action,
        Guid? performedByUserId,
        int? page,
        int? pageSize,
        AuditLogQueryService service,
        CancellationToken cancellationToken)
    {
        var result = await service.ListAsync(
            new AuditLogListQuery(
                fromDate,
                untilDate,
                entityType,
                entityId,
                action,
                performedByUserId,
                page,
                pageSize),
            cancellationToken);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : ApiResultMapper.Error(result.Error!);
    }
}
