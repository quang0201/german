using German.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionEntries;

public sealed class ProductionEntryQueryService(IGermanDbContext db)
{
    public async Task<IReadOnlyList<ProductionEntryListItemDto>> ListAsync(
        DateOnly? date,
        Guid? employeeId,
        Guid? productionOrderId,
        Guid? productionOperationId,
        CancellationToken cancellationToken)
    {
        var query =
            from entry in db.ProductionEntries.AsNoTracking()
            join employee in db.Employees.AsNoTracking() on entry.EmployeeId equals employee.Id
            join order in db.ProductionOrders.AsNoTracking() on entry.ProductionOrderId equals order.Id
            join operation in db.ProductionOperations.AsNoTracking() on entry.ProductionOperationId equals operation.Id
            where (!date.HasValue || entry.WorkDate == date.Value)
                && (!employeeId.HasValue || entry.EmployeeId == employeeId.Value)
                && (!productionOrderId.HasValue || entry.ProductionOrderId == productionOrderId.Value)
                && (!productionOperationId.HasValue || entry.ProductionOperationId == productionOperationId.Value)
            orderby entry.WorkDate descending, employee.EmployeeCode, operation.SortOrder, entry.CreatedAt
            select new ProductionEntryListItemDto(
                entry.Id,
                entry.Version,
                entry.WorkDate,
                employee.Id,
                employee.EmployeeCode,
                employee.FullName,
                order.Id,
                order.Code,
                order.ProductName,
                operation.Id,
                operation.OperationNumber,
                operation.Name,
                operation.Unit,
                entry.EntryMode,
                entry.HcQuantity,
                entry.TcQuantity,
                entry.TotalQuantity,
                entry.OvertimeHours,
                entry.WorkStart,
                entry.WorkEnd,
                entry.Note,
                entry.CreatedAt,
                entry.UpdatedAt);

        return await query.ToListAsync(cancellationToken);
    }
}
