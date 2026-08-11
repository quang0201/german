using German.Api.Auth;
using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auth;
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

        endpoints.MapGet("/api/lookups/hc-hours", async (
            Guid employeeId,
            DateOnly date,
            HttpContext context,
            IGermanDbContext db,
            CancellationToken ct) =>
        {
            var actor = context.User.ToCurrentActor();
            if (actor.Role == UserRole.Worker && actor.EmployeeId != employeeId)
            {
                return ApiResultMapper.Error(new AppError(
                    "shift.forbidden_employee",
                    "Công nhân chỉ được xem bộ ca của chính mình."));
            }

            var assignment = await db.EmployeeShiftAssignments.AsNoTracking()
                .Where(x => x.EmployeeId == employeeId
                    && x.EffectiveFrom <= date
                    && (x.EffectiveTo == null || x.EffectiveTo >= date))
                .OrderByDescending(x => x.EffectiveFrom)
                .FirstOrDefaultAsync(ct);

            if (assignment is null)
            {
                return ApiResultMapper.Error(new AppError(
                    "shift.not_found",
                    "Không có bộ ca hiệu lực cho nhân viên tại ngày đã chọn."));
            }

            var periods = await db.ShiftPeriods.AsNoTracking()
                .Where(x => x.ShiftTemplateId == assignment.ShiftTemplateId)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

            if (periods.Count == 0 || periods.Any(x => x.EndTime <= x.StartTime))
            {
                return ApiResultMapper.Error(new AppError(
                    "shift.invalid",
                    "Bộ ca không có khung giờ HC hợp lệ."));
            }

            var totalHours = periods.Sum(x => (decimal)(x.EndTime - x.StartTime).TotalHours);
            return Results.Ok(new { hcHours = totalHours });
        }).RequireAuthorization();

        return endpoints;
    }
}
