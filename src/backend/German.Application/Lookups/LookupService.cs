using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Lookups;

public sealed record ActiveProductionOrderLookupDto(
    Guid Id,
    string Code,
    string ProductName,
    decimal PlannedQuantity);

public sealed record ProductionOperationLookupDto(
    Guid Id,
    int OperationNumber,
    string Name,
    string Unit);

public sealed record HcHoursLookupDto(decimal HcHours);

public sealed class LookupService(IGermanDbContext db)
{
    public async Task<IReadOnlyList<ActiveProductionOrderLookupDto>> ListActiveProductionOrdersAsync(
        CancellationToken cancellationToken)
    {
        return await db.ProductionOrders.AsNoTracking()
            .Where(x => x.Status == ProductionOrderStatus.InProduction)
            .OrderBy(x => x.Code)
            .Select(x => new ActiveProductionOrderLookupDto(x.Id, x.Code, x.ProductName, x.PlannedQuantity))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProductionOperationLookupDto>> ListActiveOperationsAsync(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        return await db.ProductionOperations.AsNoTracking()
            .Where(x => x.ProductionOrderId == orderId && x.IsActive)
            .OrderBy(x => x.SortOrder)
            .Select(x => new ProductionOperationLookupDto(x.Id, x.OperationNumber, x.Name, x.Unit))
            .ToListAsync(cancellationToken);
    }

    public async Task<AppResult<HcHoursLookupDto>> GetHcHoursAsync(
        CurrentActor actor,
        Guid employeeId,
        DateOnly date,
        CancellationToken cancellationToken)
    {
        if (actor.Role == UserRole.Worker && actor.EmployeeId != employeeId)
        {
            return AppResult<HcHoursLookupDto>.Failure(
                "shift.forbidden_employee",
                "Công nhân chỉ được xem bộ ca của chính mình.");
        }

        var assignment = await db.EmployeeShiftAssignments.AsNoTracking()
            .Where(x => x.EmployeeId == employeeId
                && x.EffectiveFrom <= date
                && (x.EffectiveTo == null || x.EffectiveTo >= date))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);

        if (assignment is null)
        {
            return AppResult<HcHoursLookupDto>.Failure(
                "shift.not_found",
                "Không có bộ ca hiệu lực cho nhân viên tại ngày đã chọn.");
        }

        var periods = await db.ShiftPeriods.AsNoTracking()
            .Where(x => x.ShiftTemplateId == assignment.ShiftTemplateId)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);

        if (periods.Count == 0 || periods.Any(x => x.EndTime <= x.StartTime))
        {
            return AppResult<HcHoursLookupDto>.Failure(
                "shift.invalid",
                "Bộ ca không có khung giờ HC hợp lệ.");
        }

        var totalHours = periods.Sum(x => (decimal)(x.EndTime - x.StartTime).TotalHours);
        if (totalHours <= 0m)
        {
            return AppResult<HcHoursLookupDto>.Failure(
                "shift.invalid",
                "Tổng số giờ HC của bộ ca phải lớn hơn 0.");
        }

        return AppResult<HcHoursLookupDto>.Success(new HcHoursLookupDto(totalHours));
    }
}
