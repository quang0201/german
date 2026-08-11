using German.Application.Abstractions;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Api.Endpoints;

public static class LookupEndpoints
{
    public static IEndpointRouteBuilder MapLookupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/lookups/production-orders/active", async (IGermanDbContext db, CancellationToken ct) =>
        {
            var orders = await db.ProductionOrders.AsNoTracking()
                .Where(x => x.Status == ProductionOrderStatus.InProduction)
                .OrderBy(x => x.Code)
                .Select(x => new { x.Id, x.Code, x.ProductName, x.PlannedQuantity })
                .ToListAsync(ct);
            return Results.Ok(orders);
        }).RequireAuthorization();

        endpoints.MapGet("/api/production-orders/{orderId:guid}/operations", async (Guid orderId, IGermanDbContext db, CancellationToken ct) =>
        {
            var operations = await db.ProductionOperations.AsNoTracking()
                .Where(x => x.ProductionOrderId == orderId && x.IsActive)
                .OrderBy(x => x.SortOrder)
                .Select(x => new { x.Id, x.OperationNumber, x.Name, x.Unit })
                .ToListAsync(ct);
            return Results.Ok(operations);
        }).RequireAuthorization();

        return endpoints;
    }
}
