using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Reports;

public sealed class ProductionReportService(IGermanDbContext db, TimeProvider timeProvider)
{
    public async Task<AppResult<ProductionMonthlyOperationSummaryReport>> BuildMonthlyOperationSummaryAsync(
        Guid orderId,
        DateOnly? fromDate,
        DateOnly? untilDate,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var requestedFrom = fromDate ?? new DateOnly(today.Year, today.Month, 1);
        var requestedUntil = untilDate ?? requestedFrom.AddMonths(1).AddDays(-1);
        var rangeFrom = new DateOnly(requestedFrom.Year, requestedFrom.Month, 1);
        var rangeUntil = new DateOnly(requestedUntil.Year, requestedUntil.Month, 1).AddMonths(1).AddDays(-1);

        if (rangeFrom > rangeUntil)
        {
            return AppResult<ProductionMonthlyOperationSummaryReport>.Failure(
                "reports.invalid_date_range",
                "Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc.");
        }

        if (rangeUntil.DayNumber - rangeFrom.DayNumber > 366)
        {
            return AppResult<ProductionMonthlyOperationSummaryReport>.Failure(
                "reports.date_range_too_large",
                "Khoảng thời gian báo cáo tối đa là 12 tháng.");
        }

        var order = await db.ProductionOrders.AsNoTracking()
            .Where(item => item.Id == orderId)
            .Select(item => new { item.Id, item.Code, item.ProductName })
            .SingleOrDefaultAsync(cancellationToken);
        if (order is null)
        {
            return AppResult<ProductionMonthlyOperationSummaryReport>.Failure(
                "reports.order_not_found",
                "Không tìm thấy mã sản xuất.");
        }

        var operations = await db.ProductionOperations.AsNoTracking()
            .Where(item => item.ProductionOrderId == orderId)
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.OperationNumber)
            .Select(item => new { item.Id, item.OperationNumber, item.Name, item.Unit })
            .ToListAsync(cancellationToken);

        var internalAggregates = await db.ProductionEntries.AsNoTracking()
            .Where(item => !item.IsDeleted
                && item.ProductionOrderId == orderId
                && item.WorkDate >= rangeFrom
                && item.WorkDate <= rangeUntil)
            .GroupBy(item => new { item.ProductionOperationId, Year = item.WorkDate.Year, Month = item.WorkDate.Month })
            .Select(group => new
            {
                group.Key.ProductionOperationId,
                group.Key.Year,
                group.Key.Month,
                HcQuantity = group.Sum(item => item.HcQuantity),
                TcQuantity = group.Sum(item => item.TcQuantity),
                TotalQuantity = group.Sum(item => item.TotalQuantity)
            })
            .ToListAsync(cancellationToken);

        var externalAggregates = await db.ProductionExternalQuantities.AsNoTracking()
            .Where(item => item.ProductionOrderId == orderId
                && item.ReceivedDate >= rangeFrom
                && item.ReceivedDate <= rangeUntil)
            .GroupBy(item => new { item.ProductionOperationId, Year = item.ReceivedDate.Year, Month = item.ReceivedDate.Month })
            .Select(group => new
            {
                group.Key.ProductionOperationId,
                group.Key.Year,
                group.Key.Month,
                Quantity = group.Sum(item => item.Quantity)
            })
            .ToListAsync(cancellationToken);

        var internalByKey = internalAggregates.ToDictionary(
            item => (item.ProductionOperationId, item.Year, item.Month));
        var externalByKey = externalAggregates.ToDictionary(
            item => (item.ProductionOperationId, item.Year, item.Month),
            item => item.Quantity);
        var months = EnumerateMonths(rangeFrom, rangeUntil).ToArray();
        var monthDtos = months
            .Select(month => new ProductionReportMonth(month.Year, month.Month, MonthKey(month)))
            .ToArray();
        var summaries = operations.Select(operation =>
        {
            var monthSummaries = months.Select(month =>
            {
                internalByKey.TryGetValue((operation.Id, month.Year, month.Month), out var internalValue);
                externalByKey.TryGetValue((operation.Id, month.Year, month.Month), out var externalQuantity);
                var totalQuantity = internalValue?.TotalQuantity ?? 0m;
                return new ProductionOperationMonthSummary(
                    MonthKey(month),
                    internalValue?.HcQuantity ?? 0m,
                    internalValue?.TcQuantity ?? 0m,
                    totalQuantity,
                    externalQuantity,
                    totalQuantity + externalQuantity);
            }).ToArray();

            return new ProductionMonthlyOperationSummary(
                operation.Id,
                operation.OperationNumber,
                operation.Name,
                operation.Unit,
                monthSummaries,
                monthSummaries.Sum(item => item.HcQuantity),
                monthSummaries.Sum(item => item.TcQuantity),
                monthSummaries.Sum(item => item.TotalQuantity),
                monthSummaries.Sum(item => item.ExternalQuantity),
                monthSummaries.Sum(item => item.CombinedTotalQuantity));
        }).ToArray();

        return AppResult<ProductionMonthlyOperationSummaryReport>.Success(
            new ProductionMonthlyOperationSummaryReport(
                order.Id,
                order.Code,
                order.ProductName,
                summaries.Length,
                monthDtos,
                summaries));
    }

    public async Task<AppResult<ProductionOperationSummaryReport>> BuildOperationSummaryAsync(
        Guid orderId,
        DateOnly? fromDate,
        DateOnly? untilDate,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var rangeFrom = fromDate ?? untilDate ?? today;
        var rangeUntil = untilDate ?? fromDate ?? today;

        if (rangeFrom > rangeUntil)
        {
            return AppResult<ProductionOperationSummaryReport>.Failure(
                "reports.invalid_date_range",
                "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
        }

        if (rangeUntil.DayNumber - rangeFrom.DayNumber > 365)
        {
            return AppResult<ProductionOperationSummaryReport>.Failure(
                "reports.date_range_too_large",
                "Khoảng thời gian báo cáo tối đa là 366 ngày.");
        }

        var order = await db.ProductionOrders.AsNoTracking()
            .Where(item => item.Id == orderId)
            .Select(item => new { item.Id, item.Code, item.ProductName })
            .SingleOrDefaultAsync(cancellationToken);
        if (order is null)
        {
            return AppResult<ProductionOperationSummaryReport>.Failure(
                "reports.order_not_found",
                "Không tìm thấy mã sản xuất.");
        }

        var operations = await db.ProductionOperations.AsNoTracking()
            .Where(item => item.ProductionOrderId == orderId)
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.OperationNumber)
            .Select(item => new
            {
                item.Id,
                item.OperationNumber,
                item.Name,
                item.Unit
            })
            .ToListAsync(cancellationToken);

        var aggregates = await db.ProductionEntries.AsNoTracking()
            .Where(item => !item.IsDeleted
                && item.ProductionOrderId == orderId
                && item.WorkDate >= rangeFrom
                && item.WorkDate <= rangeUntil)
            .GroupBy(item => item.ProductionOperationId)
            .Select(group => new
            {
                OperationId = group.Key,
                HcQuantity = group.Sum(item => item.HcQuantity),
                TcQuantity = group.Sum(item => item.TcQuantity),
                TotalQuantity = group.Sum(item => item.TotalQuantity)
            })
            .ToListAsync(cancellationToken);

        var aggregateByOperation = aggregates.ToDictionary(item => item.OperationId);
        var externalAggregates = await db.ProductionExternalQuantities.AsNoTracking()
            .Where(item => item.ProductionOrderId == orderId
                && item.ReceivedDate >= rangeFrom
                && item.ReceivedDate <= rangeUntil)
            .GroupBy(item => item.ProductionOperationId)
            .Select(group => new
            {
                OperationId = group.Key,
                Quantity = group.Sum(item => item.Quantity)
            })
            .ToListAsync(cancellationToken);
        var externalByOperation = externalAggregates.ToDictionary(item => item.OperationId, item => item.Quantity);
        var summaries = operations
            .Select(operation =>
            {
                aggregateByOperation.TryGetValue(operation.Id, out var aggregate);
                externalByOperation.TryGetValue(operation.Id, out var externalQuantity);
                var totalQuantity = aggregate?.TotalQuantity ?? 0m;
                return new ProductionOperationSummary(
                    operation.Id,
                    operation.OperationNumber,
                    operation.Name,
                    operation.Unit,
                    aggregate?.HcQuantity ?? 0m,
                    aggregate?.TcQuantity ?? 0m,
                    totalQuantity,
                    externalQuantity,
                    totalQuantity + externalQuantity);
            })
            .ToArray();

        return AppResult<ProductionOperationSummaryReport>.Success(
            new ProductionOperationSummaryReport(
                order.Id,
                order.Code,
                order.ProductName,
                summaries.Length,
                summaries));
    }

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
                && (entry.HcQuantity != 0m || entry.TcQuantity != 0m || entry.TotalQuantity != 0m)
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

        var internalRows = await query
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

        var externalRows = new List<ProductionReportRow>();
        {
            var externalQuery =
                from external in db.ProductionExternalQuantities.AsNoTracking()
                join order in db.ProductionOrders.AsNoTracking() on external.ProductionOrderId equals order.Id
                join operation in db.ProductionOperations.AsNoTracking() on external.ProductionOperationId equals operation.Id
                join sourceEmployee in db.Employees.AsNoTracking() on external.SourceEmployeeId equals sourceEmployee.Id into sourceEmployees
                from sourceEmployee in sourceEmployees.DefaultIfEmpty()
                join externalSource in db.ProductionExternalSources.AsNoTracking() on external.ExternalSourceId equals externalSource.Id into externalSources
                from externalSource in externalSources.DefaultIfEmpty()
                where external.ReceivedDate >= fromDate
                    && external.ReceivedDate <= untilDate
                    && (!filter.EmployeeId.HasValue || external.SourceEmployeeId == filter.EmployeeId.Value)
                    && (!filter.OrderId.HasValue || external.ProductionOrderId == filter.OrderId.Value)
                    && (!filter.OperationId.HasValue || external.ProductionOperationId == filter.OperationId.Value)
                select new { external, order, operation, sourceEmployee, externalSource };

            if (filter.ExcludeSundays)
            {
                var sundays = GetSundays(fromDate, untilDate);
                if (sundays.Length > 0)
                {
                    externalQuery = externalQuery.Where(item => !sundays.Contains(item.external.ReceivedDate));
                }
            }

            var externalItems = await externalQuery
                .OrderBy(item => item.external.ReceivedDate)
                .ThenBy(item => item.order.Code)
                .ThenBy(item => item.operation.OperationNumber)
                .ToListAsync(cancellationToken);

            foreach (var item in externalItems)
            {
                var source = item.externalSource?.Name ?? item.sourceEmployee?.FullName;
                if (string.IsNullOrWhiteSpace(source))
                {
                    source = string.IsNullOrWhiteSpace(item.external.SourceName)
                        ? "Gia công ngoài"
                        : item.external.SourceName.Trim();
                }

                if (search is not null
                    && !source.Contains(search.Text, StringComparison.OrdinalIgnoreCase)
                    && !item.order.Code.Contains(search.Text, StringComparison.OrdinalIgnoreCase)
                    && !item.order.ProductName.Contains(search.Text, StringComparison.OrdinalIgnoreCase)
                    && !item.operation.Name.Contains(search.Text, StringComparison.OrdinalIgnoreCase)
                    && !(item.external.Note?.Contains(search.Text, StringComparison.OrdinalIgnoreCase) ?? false))
                {
                    continue;
                }

                externalRows.Add(new ProductionReportRow(
                    item.external.ReceivedDate,
                    item.sourceEmployee?.EmployeeCode ?? "__EXTERNAL__",
                    source,
                    item.order.Code,
                    item.order.ProductName,
                    item.operation.OperationNumber,
                    item.operation.Name,
                    item.operation.Unit,
                    item.external.Quantity,
                    0m,
                    item.external.Quantity,
                    null,
                    ProductionEntryMode.Direct,
                    item.external.Note,
                    true));
            }
        }

        var rows = internalRows
            .Concat(externalRows)
            .OrderBy(item => item.WorkDate)
            .ThenBy(item => item.EmployeeCode, StringComparer.Ordinal)
            .ThenBy(item => item.ProductionOrderCode, StringComparer.Ordinal)
            .ThenBy(item => item.OperationNumber)
            .ToList();

        var summary = new ProductionReportSummary(
            rows.Select(row => new { row.EmployeeCode, row.EmployeeName }).Distinct().Count(),
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
                group.Sum(row => row.TotalQuantity),
                group.All(row => row.IsExternal)))
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

    private static IEnumerable<DateOnly> EnumerateMonths(DateOnly fromDate, DateOnly untilDate)
    {
        for (var month = new DateOnly(fromDate.Year, fromDate.Month, 1);
             month <= untilDate;
             month = month.AddMonths(1))
        {
            yield return month;
        }
    }

    private static string MonthKey(DateOnly month) => $"{month.Year:0000}-{month.Month:00}";
}
