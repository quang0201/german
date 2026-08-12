using German.Application.Abstractions;
using German.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Reports;

public sealed class ProductionReportService(IGermanDbContext db, TimeProvider timeProvider)
{
    public async Task<AppResult<ProductionReportData>> BuildAsync(
        ProductionReportFilter filter,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var fromDate = filter.FromDate ?? filter.UntilDate ?? today;
        var untilDate = filter.UntilDate ?? filter.FromDate ?? today;

        if (fromDate > untilDate)
        {
            return AppResult<ProductionReportData>.Failure(
                "reports.invalid_date_range",
                "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
        }

        if (untilDate.DayNumber - fromDate.DayNumber > 365)
        {
            return AppResult<ProductionReportData>.Failure(
                "reports.date_range_too_large",
                "Khoảng thời gian export tối đa là 366 ngày.");
        }

        var entries = db.ProductionEntries.AsNoTracking()
            .Where(x => !x.IsDeleted && x.WorkDate >= fromDate && x.WorkDate <= untilDate);

        if (filter.EmployeeId.HasValue)
        {
            entries = entries.Where(x => x.EmployeeId == filter.EmployeeId.Value);
        }

        if (filter.OrderId.HasValue)
        {
            entries = entries.Where(x => x.ProductionOrderId == filter.OrderId.Value);
        }

        if (filter.OperationId.HasValue)
        {
            entries = entries.Where(x => x.ProductionOperationId == filter.OperationId.Value);
        }

        var rows = await (
            from entry in entries
            join employee in db.Employees.AsNoTracking() on entry.EmployeeId equals employee.Id
            join order in db.ProductionOrders.AsNoTracking() on entry.ProductionOrderId equals order.Id
            join operation in db.ProductionOperations.AsNoTracking() on entry.ProductionOperationId equals operation.Id
            orderby entry.WorkDate, employee.EmployeeCode, order.Code, operation.OperationNumber
            select new ProductionReportRow(
                entry.WorkDate,
                employee.EmployeeCode,
                employee.FullName,
                order.Code,
                order.ProductName,
                operation.OperationNumber,
                operation.Name,
                operation.Unit,
                entry.HcQuantity,
                entry.TcQuantity,
                entry.TotalQuantity,
                entry.OvertimeHours,
                entry.EntryMode,
                entry.Note))
            .ToListAsync(cancellationToken);

        return AppResult<ProductionReportData>.Success(
            new ProductionReportData(fromDate, untilDate, rows));
    }
}
