using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Attendance;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionEntries;

public sealed class ProductionMonthlyMatrixService(IGermanDbContext db)
{
    public async Task<AppResult<ProductionMonthlyMatrixResult>> GetAsync(
        ProductionMonthlyMatrixQuery request,
        CancellationToken cancellationToken)
    {
        if (request.Year is < 1 or > 9999 || request.Month is < 1 or > 12)
        {
            return AppResult<ProductionMonthlyMatrixResult>.Failure(
                "production_matrix.invalid_month",
                "Tháng sản lượng không hợp lệ.");
        }

        var fromDate = new DateOnly(request.Year, request.Month, 1);
        var untilDate = fromDate.AddMonths(1).AddDays(-1);

        return await GetRangeAsync(
            fromDate,
            untilDate,
            fromDate,
            untilDate,
            request.EmployeeId,
            request.OrderId,
            request.OperationId,
            request.Search,
            request.ExcludeSundays,
            cancellationToken);
    }

    public async Task<AppResult<ProductionMonthlyMatrixResult>> GetWeeklyAsync(
        ProductionWeeklyMatrixQuery request,
        CancellationToken cancellationToken)
    {
        if (request.FromDate.DayOfWeek != DayOfWeek.Monday
            || request.UntilDate != request.FromDate.AddDays(6))
        {
            return AppResult<ProductionMonthlyMatrixResult>.Failure(
                "production_matrix.invalid_week",
                "Khoảng tuần phải bắt đầu từ thứ 2 và kết thúc vào Chủ nhật.");
        }

        return await GetRangeAsync(
            request.FromDate,
            request.UntilDate,
            new DateOnly(request.FromDate.Year, request.FromDate.Month, 1),
            new DateOnly(request.UntilDate.Year, request.UntilDate.Month, 1).AddMonths(1).AddDays(-1),
            request.EmployeeId,
            request.OrderId,
            request.OperationId,
            request.Search,
            request.ExcludeSundays,
            cancellationToken);
    }

    private async Task<AppResult<ProductionMonthlyMatrixResult>> GetRangeAsync(
        DateOnly fromDate,
        DateOnly untilDate,
        DateOnly groupFromDate,
        DateOnly groupUntilDate,
        Guid? employeeId,
        Guid? orderId,
        Guid? operationId,
        string? searchText,
        bool excludeSundays,
        CancellationToken cancellationToken)
    {

        var query =
            from entry in db.ProductionEntries.AsNoTracking()
            join employee in db.Employees.AsNoTracking() on entry.EmployeeId equals employee.Id
            join order in db.ProductionOrders.AsNoTracking() on entry.ProductionOrderId equals order.Id
            join operation in db.ProductionOperations.AsNoTracking() on entry.ProductionOperationId equals operation.Id
            where entry.WorkDate >= groupFromDate
                && entry.WorkDate <= groupUntilDate
                && (entry.HcQuantity != 0m || entry.TcQuantity != 0m || entry.TotalQuantity != 0m)
                && (employee.IsActive || !employee.DeactivatedAt.HasValue || employee.DeactivatedAt.Value >= groupFromDate)
                && (!employeeId.HasValue || entry.EmployeeId == employeeId.Value)
                select new { entry, employee, order, operation };

        var search = ProductionEntrySearch.Normalize(searchText);
        if (search is not null)
        {
            var text = search.LoweredText;
            var modes = search.EntryModes;
            query = query.Where(item =>
                item.employee.EmployeeCode.ToLower().Contains(text)
                || item.employee.FullName.ToLower().Contains(text)
                || item.order.Code.ToLower().Contains(text)
                || item.order.ProductName.ToLower().Contains(text)
                || item.operation.Name.ToLower().Contains(text)
                || modes.Contains(item.entry.EntryMode));
        }

        var allGroupRows = await query
            .OrderBy(item => item.order.Code)
            .ThenBy(item => item.employee.EmployeeCode)
            .ThenBy(item => item.operation.OperationNumber)
            .ThenBy(item => item.entry.WorkDate)
            .ThenBy(item => item.entry.CreatedAt)
            .ThenBy(item => item.entry.Id)
            .Select(item => new ProductionMonthlyMatrixRow(
                item.entry.Id, item.entry.Version, item.entry.WorkDate, item.entry.EntryMode,
                item.entry.HcQuantity, item.entry.TcQuantity, item.entry.TotalQuantity,
                item.entry.Note, item.entry.CreatedAt,
                item.employee.Id, item.employee.EmployeeCode, item.employee.FullName, item.employee.IsActive,
                item.order.Id, item.order.Code, item.order.ProductName,
                item.order.CreatedAt,
                item.operation.Id, item.operation.OperationNumber, item.operation.Name))
            .ToListAsync(cancellationToken);
        var groupRows = operationId.HasValue
            ? allGroupRows.Where(row => row.OperationId == operationId.Value).ToList()
            : allGroupRows;
        var rows = groupRows
            .Where(row => row.WorkDate >= fromDate && row.WorkDate <= untilDate)
            .ToList();

        var employeeIds = groupRows.Select(row => row.EmployeeId).Distinct().ToArray();
        var attendanceDates = employeeIds.Length == 0
            ? new HashSet<(Guid EmployeeId, DateOnly WorkDate)>()
            : (await db.AttendanceDays.AsNoTracking()
                .Where(day => employeeIds.Contains(day.EmployeeId)
                    && day.WorkDate >= fromDate
                    && day.WorkDate <= untilDate)
                .Select(day => new { day.EmployeeId, day.WorkDate })
                .ToListAsync(cancellationToken))
                .Select(day => (day.EmployeeId, day.WorkDate))
                .ToHashSet();
        var paidLeaveDates = employeeIds.Length == 0
            ? new HashSet<(Guid EmployeeId, DateOnly WorkDate)>()
            : (await db.AttendanceDays.AsNoTracking()
                .Where(day => employeeIds.Contains(day.EmployeeId)
                    && day.WorkDate >= fromDate
                    && day.WorkDate <= untilDate
                    && day.Shifts.Any(shift => shift.ValueKind == AttendanceShiftValueKind.PaidLeave))
                .Select(day => new { day.EmployeeId, day.WorkDate })
                .ToListAsync(cancellationToken))
                .Select(day => (day.EmployeeId, day.WorkDate))
                .ToHashSet();
        var workedDates = employeeIds.Length == 0
            ? new HashSet<(Guid EmployeeId, DateOnly WorkDate)>()
            : (await db.AttendanceDays.AsNoTracking()
                .Where(day => employeeIds.Contains(day.EmployeeId)
                    && day.WorkDate >= fromDate
                    && day.WorkDate <= untilDate
                    && (day.OvertimeHours > 0m
                        || day.Shifts.Any(shift => shift.ValueKind == AttendanceShiftValueKind.Hours)))
                .Select(day => new { day.EmployeeId, day.WorkDate })
                .ToListAsync(cancellationToken))
                .Select(day => (day.EmployeeId, day.WorkDate))
                .ToHashSet();

        return AppResult<ProductionMonthlyMatrixResult>.Success(
            ProductionMonthlyMatrixBuilder.Build(fromDate, untilDate, orderId, excludeSundays, rows, groupRows, allGroupRows, workedDates, attendanceDates, paidLeaveDates));
    }
}

internal sealed record ProductionMonthlyMatrixRow(
    Guid Id, int Version, DateOnly WorkDate, ProductionEntryMode EntryMode,
    decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity,
    string? Note, DateTimeOffset CreatedAt,
    Guid EmployeeId, string EmployeeCode, string EmployeeName, bool EmployeeIsActive,
    Guid OrderId, string OrderCode, string ProductName, DateTimeOffset OrderCreatedAt,
    Guid OperationId, int OperationNumber, string OperationName);
