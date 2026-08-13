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

        var query =
            from entry in db.ProductionEntries.AsNoTracking()
            join employee in db.Employees.AsNoTracking() on entry.EmployeeId equals employee.Id
            join order in db.ProductionOrders.AsNoTracking() on entry.ProductionOrderId equals order.Id
            join operation in db.ProductionOperations.AsNoTracking() on entry.ProductionOperationId equals operation.Id
            where !entry.IsDeleted
                && entry.WorkDate >= fromDate
                && entry.WorkDate <= untilDate
                && (!filter.EmployeeId.HasValue || entry.EmployeeId == filter.EmployeeId.Value)
                && (!filter.OrderId.HasValue || entry.ProductionOrderId == filter.OrderId.Value)
                && (!filter.OperationId.HasValue || entry.ProductionOperationId == filter.OperationId.Value)
            select new { entry, employee, order, operation };

        if (filter.ExcludeSundays)
        {
            var sundays = GetSundays(fromDate, untilDate);
            if (sundays.Length > 0)
            {
                query = query.Where(item => !sundays.Contains(item.entry.WorkDate));
            }
        }

        var search = ProductionEntrySearch.Normalize(filter.Search);
        if (search is not null)
        {
            var loweredSearch = search.LoweredText;
            var entryModes = search.EntryModes;
            query = query.Where(item =>
                item.employee.EmployeeCode.ToLower().Contains(loweredSearch)
                || item.employee.FullName.ToLower().Contains(loweredSearch)
                || item.order.Code.ToLower().Contains(loweredSearch)
                || item.order.ProductName.ToLower().Contains(loweredSearch)
                || item.operation.Name.ToLower().Contains(loweredSearch)
                || entryModes.Contains(item.entry.EntryMode));
        }

        var rows = await query
            .OrderBy(item => item.entry.WorkDate)
            .ThenBy(item => item.employee.EmployeeCode)
            .ThenBy(item => item.order.Code)
            .ThenBy(item => item.operation.OperationNumber)
            .Select(item => new ProductionReportRow(
                item.entry.WorkDate,
                item.employee.EmployeeCode,
                item.employee.FullName,
                item.order.Code,
                item.order.ProductName,
                item.operation.OperationNumber,
                item.operation.Name,
                item.operation.Unit,
                item.entry.HcQuantity,
                item.entry.TcQuantity,
                item.entry.TotalQuantity,
                item.entry.OvertimeHours,
                item.entry.EntryMode,
                item.entry.Note))
            .ToListAsync(cancellationToken);

        var summary = new ProductionReportSummary(
            rows.Select(row => row.EmployeeCode).Distinct().Count(),
            rows.Count,
            rows.Sum(row => row.HcQuantity),
            rows.Sum(row => row.TcQuantity),
            rows.Sum(row => row.TotalQuantity));
        var byDay = rows
            .GroupBy(row => row.WorkDate)
            .OrderBy(group => group.Key)
            .Select(group => new ProductionReportDaySummary(
                group.Key,
                group.Sum(row => row.HcQuantity),
                group.Sum(row => row.TcQuantity),
                group.Sum(row => row.TotalQuantity)))
            .ToArray();
        var byEmployee = rows
            .GroupBy(row => new { row.EmployeeCode, row.EmployeeName })
            .OrderBy(group => group.Key.EmployeeCode)
            .ThenBy(group => group.Key.EmployeeName)
            .Select(group => new ProductionReportEmployeeSummary(
                group.Key.EmployeeCode,
                group.Key.EmployeeName,
                group.Sum(row => row.HcQuantity),
                group.Sum(row => row.TcQuantity),
                group.Sum(row => row.TotalQuantity)))
            .ToArray();

        return AppResult<ProductionReportData>.Success(
            new ProductionReportData(fromDate, untilDate, rows)
            {
                EmployeeLabel = await GetEmployeeLabelAsync(filter.EmployeeId, cancellationToken),
                OrderLabel = await GetOrderLabelAsync(filter.OrderId, cancellationToken),
                OperationLabel = await GetOperationLabelAsync(filter.OperationId, cancellationToken),
                SearchLabel = search?.Text ?? "Tất cả",
                FinalMetricLabel = filter.OperationId.HasValue ? "Tổng sản lượng" : "Tổng lượt công đoạn",
                ExcludeSundays = filter.ExcludeSundays,
                Summary = summary,
                ByDay = byDay,
                ByEmployee = byEmployee
            });
    }

    private async Task<string> GetEmployeeLabelAsync(Guid? employeeId, CancellationToken cancellationToken)
    {
        if (!employeeId.HasValue)
        {
            return "Tất cả";
        }

        var employee = await db.Employees.AsNoTracking()
            .Where(item => item.Id == employeeId.Value)
            .Select(item => new { item.EmployeeCode, item.FullName })
            .SingleOrDefaultAsync(cancellationToken);
        return employee is null ? "Tất cả" : $"{employee.EmployeeCode} — {employee.FullName}";
    }

    private async Task<string> GetOrderLabelAsync(Guid? orderId, CancellationToken cancellationToken)
    {
        if (!orderId.HasValue)
        {
            return "Tất cả";
        }

        var order = await db.ProductionOrders.AsNoTracking()
            .Where(item => item.Id == orderId.Value)
            .Select(item => new { item.Code, item.ProductName })
            .SingleOrDefaultAsync(cancellationToken);
        return order is null ? "Tất cả" : $"{order.Code} — {order.ProductName}";
    }

    private async Task<string> GetOperationLabelAsync(Guid? operationId, CancellationToken cancellationToken)
    {
        if (!operationId.HasValue)
        {
            return "Tất cả";
        }

        var operation = await db.ProductionOperations.AsNoTracking()
            .Where(item => item.Id == operationId.Value)
            .Select(item => new { item.OperationNumber, item.Name })
            .SingleOrDefaultAsync(cancellationToken);
        return operation is null ? "Tất cả" : $"CĐ{operation.OperationNumber} — {operation.Name}";
    }

    private static DateOnly[] GetSundays(DateOnly fromDate, DateOnly untilDate)
    {
        var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)fromDate.DayOfWeek + 7) % 7;
        var firstSunday = fromDate.AddDays(daysUntilSunday);
        if (firstSunday > untilDate)
        {
            return [];
        }

        var result = new List<DateOnly>();
        for (var date = firstSunday; date <= untilDate; date = date.AddDays(7))
        {
            result.Add(date);
        }

        return result.ToArray();
    }
}
