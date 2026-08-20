using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionEntries;

public sealed class ProductionEntryQueryService(IGermanDbContext db, TimeProvider timeProvider)
{
    private static readonly IReadOnlySet<int> AllowedPageSizes = new HashSet<int> { 25, 50, 100 };

    public async Task<AppResult<ProductionEntryListResult>> ListAsync(
        ProductionEntryListQuery request,
        CancellationToken cancellationToken)
    {
        var normalized = Normalize(request);
        if (!normalized.IsSuccess)
        {
            return AppResult<ProductionEntryListResult>.Failure(
                normalized.Error!.Code,
                normalized.Error.Message);
        }

        var normalizedQuery = normalized.Value!;

        var query =
            from entry in db.ProductionEntries.AsNoTracking()
            join employee in db.Employees.AsNoTracking() on entry.EmployeeId equals employee.Id
            join order in db.ProductionOrders.AsNoTracking() on entry.ProductionOrderId equals order.Id
            join operation in db.ProductionOperations.AsNoTracking() on entry.ProductionOperationId equals operation.Id
            where entry.WorkDate >= normalizedQuery.FromDate
                && entry.WorkDate <= normalizedQuery.UntilDate
                && (!request.EmployeeId.HasValue || entry.EmployeeId == request.EmployeeId.Value)
                && (!request.OrderId.HasValue || entry.ProductionOrderId == request.OrderId.Value)
                && (!request.OperationId.HasValue || entry.ProductionOperationId == request.OperationId.Value)
            select new { entry, employee, order, operation };

        if (normalizedQuery.Search is not null)
        {
            var search = normalizedQuery.Search;
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

        var summaryValues = await query
            .GroupBy(_ => 1)
            .Select(group => new
            {
                EmployeeCount = group.Select(item => item.entry.EmployeeId).Distinct().Count(),
                EntryCount = group.Count(),
                HcQuantity = group.Sum(item => (decimal?)item.entry.HcQuantity),
                TcQuantity = group.Sum(item => (decimal?)item.entry.TcQuantity),
                TotalQuantity = group.Sum(item => (decimal?)item.entry.TotalQuantity)
            })
            .SingleOrDefaultAsync(cancellationToken);

        var summary = summaryValues is null
            ? new ProductionEntrySummaryDto(0, 0, 0m, 0m, 0m)
            : new ProductionEntrySummaryDto(
                summaryValues.EmployeeCount,
                summaryValues.EntryCount,
                summaryValues.HcQuantity ?? 0m,
                summaryValues.TcQuantity ?? 0m,
                summaryValues.TotalQuantity ?? 0m);

        var totalCount = summary.EntryCount;
        var totalPages = totalCount == 0
            ? 0
            : (int)Math.Ceiling(totalCount / (double)normalizedQuery.PageSize);

        var items = await query
            .OrderByDescending(item => item.entry.WorkDate)
            .ThenBy(item => item.employee.EmployeeCode)
            .ThenBy(item => item.operation.OperationNumber)
            .ThenBy(item => item.entry.CreatedAt)
            .ThenBy(item => item.entry.Id)
            .Skip((normalizedQuery.Page - 1) * normalizedQuery.PageSize)
            .Take(normalizedQuery.PageSize)
            .Select(item => new ProductionEntryListItemDto(
                item.entry.Id,
                item.entry.Version,
                item.entry.WorkDate,
                item.employee.Id,
                item.employee.EmployeeCode,
                item.employee.FullName,
                item.order.Id,
                item.order.Code,
                item.order.ProductName,
                item.operation.Id,
                item.operation.OperationNumber,
                item.operation.Name,
                item.operation.Unit,
                item.entry.EntryMode,
                item.entry.HcQuantity,
                item.entry.TcQuantity,
                item.entry.TotalQuantity,
                item.entry.OvertimeHours,
                item.entry.WorkStart,
                item.entry.WorkEnd,
                item.entry.Note,
                item.entry.CreatedAt,
                item.entry.UpdatedAt))
            .ToListAsync(cancellationToken);

        return AppResult<ProductionEntryListResult>.Success(
            new ProductionEntryListResult(
                items,
                normalizedQuery.Page,
                normalizedQuery.PageSize,
                totalCount,
                totalPages,
                summary));
    }

    public Task<AppResult<ProductionEntryListResult>> ListMineAsync(
        CurrentActor actor,
        ProductionEntryListQuery request,
        CancellationToken cancellationToken)
    {
        if (actor.EmployeeId is null)
        {
            return Task.FromResult(
                AppResult<ProductionEntryListResult>.Failure(
                    "production_entry.history_forbidden",
                    "Tài khoản chưa được gắn với nhân viên."));
        }

        return ListAsync(request with { EmployeeId = actor.EmployeeId }, cancellationToken);
    }

    public async Task<AppResult<ProductionEntryDetailDto>> GetDetailAsync(
        CurrentActor actor,
        Guid entryId,
        CancellationToken cancellationToken)
    {
        var entry = await db.ProductionEntries
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == entryId, cancellationToken);

        if (entry is null || entry.IsDeleted)
        {
            return AppResult<ProductionEntryDetailDto>.Failure(
                "production_entry.not_found",
                "Không tìm thấy sản lượng.");
        }

        if (actor.Role == UserRole.Worker && actor.EmployeeId != entry.EmployeeId)
        {
            return AppResult<ProductionEntryDetailDto>.Failure(
                "production_entry.read_forbidden",
                "Bạn không có quyền xem sản lượng này.");
        }

        var result = await (
            from current in db.ProductionEntries.AsNoTracking()
            where current.Id == entryId
            join employee in db.Employees.AsNoTracking() on current.EmployeeId equals employee.Id
            join order in db.ProductionOrders.AsNoTracking() on current.ProductionOrderId equals order.Id
            join operation in db.ProductionOperations.AsNoTracking() on current.ProductionOperationId equals operation.Id
            join submittedBy in db.UserAccounts.AsNoTracking() on current.SubmittedByUserId equals submittedBy.Id
            join submittedEmployee in db.Employees.AsNoTracking()
                on submittedBy.EmployeeId equals submittedEmployee.Id into submittedEmployees
            from submittedEmployee in submittedEmployees.DefaultIfEmpty()
            select new ProductionEntryDetailDto(
                current.Id,
                current.Version,
                current.WorkDate,
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
                current.EntryMode,
                current.Shift1Quantity,
                current.Shift2Quantity,
                current.DirectHcQuantity,
                current.DirectTcQuantity,
                current.TotalInputQuantity,
                current.OvertimeHours,
                current.OvertimeQuantity,
                current.WorkStart,
                current.WorkEnd,
                current.HcQuantity,
                current.TcQuantity,
                current.TotalQuantity,
                current.Note,
                submittedBy.Id,
                submittedBy.Username,
                submittedEmployee == null ? null : submittedEmployee.EmployeeCode,
                submittedEmployee == null ? null : submittedEmployee.FullName,
                current.CreatedAt,
                current.UpdatedAt,
                current.HcHours))
            .SingleOrDefaultAsync(cancellationToken);

        return result is null
            ? AppResult<ProductionEntryDetailDto>.Failure(
                "production_entry.not_found",
                "Không tìm thấy sản lượng.")
            : AppResult<ProductionEntryDetailDto>.Success(result);
    }

    private NormalizedQueryResult Normalize(ProductionEntryListQuery request)
    {
        if (request.Date.HasValue && (request.FromDate.HasValue || request.UntilDate.HasValue))
        {
            return NormalizedQueryResult.Failure(
                "production_entry.conflicting_date_filters",
                "Không được truyền date cùng fromDate hoặc untilDate.");
        }

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var fromDate = request.Date ?? request.FromDate ?? request.UntilDate ?? today;
        var untilDate = request.Date ?? request.UntilDate ?? request.FromDate ?? today;

        if (fromDate > untilDate)
        {
            return NormalizedQueryResult.Failure(
                "production_entry.invalid_date_range",
                "Khoảng ngày không hợp lệ.");
        }

        if (untilDate.DayNumber - fromDate.DayNumber + 1 > 31)
        {
            return NormalizedQueryResult.Failure(
                "production_entry.date_range_too_large",
                "Khoảng ngày không được vượt quá 31 ngày.");
        }

        var page = request.Page ?? 1;
        if (page < 1)
        {
            return NormalizedQueryResult.Failure(
                "production_entry.invalid_page",
                "Số trang phải lớn hơn hoặc bằng 1.");
        }

        var pageSize = request.PageSize ?? 50;
        if (!AllowedPageSizes.Contains(pageSize))
        {
            return NormalizedQueryResult.Failure(
                "production_entry.invalid_page_size",
                "Kích thước trang chỉ được là 25, 50 hoặc 100.");
        }

        return NormalizedQueryResult.Success(
            new NormalizedQuery(
                fromDate,
                untilDate,
                ProductionEntrySearch.Normalize(request.Search),
                page,
                pageSize));
    }

    private sealed record NormalizedQuery(
        DateOnly FromDate,
        DateOnly UntilDate,
        ProductionEntrySearchCriteria? Search,
        int Page,
        int PageSize);

    private sealed record NormalizedQueryResult(bool IsSuccess, NormalizedQuery? Value, AppError? Error)
    {
        public static NormalizedQueryResult Success(NormalizedQuery value) => new(true, value, null);

        public static NormalizedQueryResult Failure(string code, string message) =>
            new(false, null, new AppError(code, message));
    }
}
