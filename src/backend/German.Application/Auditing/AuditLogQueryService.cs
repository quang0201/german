using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auditing;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Auditing;

public sealed class AuditLogQueryService(IGermanDbContext db, TimeProvider timeProvider)
{
    private static readonly IReadOnlySet<int> AllowedPageSizes = new HashSet<int> { 25, 50, 100 };

    public async Task<AppResult<PagedResult<AuditLogListItemDto>>> ListAsync(
        AuditLogListQuery request,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var fromDate = request.FromDate ?? request.UntilDate ?? today;
        var untilDate = request.UntilDate ?? request.FromDate ?? today;
        if (fromDate > untilDate)
        {
            return Failure("audit.invalid_date_range", "Khoảng ngày không hợp lệ.");
        }

        var page = request.Page ?? 1;
        if (page < 1)
        {
            return Failure("audit.invalid_page", "Số trang phải lớn hơn hoặc bằng 1.");
        }

        var pageSize = request.PageSize ?? 50;
        if (!AllowedPageSizes.Contains(pageSize))
        {
            return Failure("audit.invalid_page_size", "Kích thước trang chỉ được là 25, 50 hoặc 100.");
        }

        var fromUtc = fromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var untilExclusiveUtc = untilDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var entityType = request.EntityType?.Trim();

        var query =
            from audit in db.AuditLogs.AsNoTracking()
            join user in db.UserAccounts.AsNoTracking() on audit.PerformedByUserId equals user.Id
            join employee in db.Employees.AsNoTracking()
                on user.EmployeeId equals employee.Id into employees
            from employee in employees.DefaultIfEmpty()
            where audit.PerformedAt.UtcDateTime >= fromUtc
                && audit.PerformedAt.UtcDateTime < untilExclusiveUtc
                && (entityType == null || audit.EntityType == entityType)
                && (!request.EntityId.HasValue || audit.EntityId == request.EntityId.Value)
                && (!request.Action.HasValue || audit.Action == request.Action.Value)
                && (!request.PerformedByUserId.HasValue || audit.PerformedByUserId == request.PerformedByUserId.Value)
            orderby audit.PerformedAt descending, audit.Id descending
            select new AuditLogListItemDto(
                audit.Id,
                audit.EntityType,
                audit.EntityId,
                audit.Action,
                audit.PerformedAt,
                user.Id,
                user.Username,
                employee == null ? null : employee.EmployeeCode,
                employee == null ? null : employee.FullName,
                audit.BeforeJson,
                audit.AfterJson);

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return AppResult<PagedResult<AuditLogListItemDto>>.Success(
            new PagedResult<AuditLogListItemDto>(items, page, pageSize, totalCount, totalPages));
    }

    private static AppResult<PagedResult<AuditLogListItemDto>> Failure(string code, string message) =>
        AppResult<PagedResult<AuditLogListItemDto>>.Failure(code, message);
}
