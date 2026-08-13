using German.Application.Abstractions;
using German.Application.Common;
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

        var query =
            from entry in db.ProductionEntries.AsNoTracking()
            join employee in db.Employees.AsNoTracking() on entry.EmployeeId equals employee.Id
            join order in db.ProductionOrders.AsNoTracking() on entry.ProductionOrderId equals order.Id
            join operation in db.ProductionOperations.AsNoTracking() on entry.ProductionOperationId equals operation.Id
            where entry.WorkDate >= fromDate
                && entry.WorkDate <= untilDate
                && (!request.EmployeeId.HasValue || entry.EmployeeId == request.EmployeeId.Value)
                && (!request.OperationId.HasValue || entry.ProductionOperationId == request.OperationId.Value)
            select new { entry, employee, order, operation };

        var search = ProductionEntrySearch.Normalize(request.Search);
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

        var rows = await query
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
                item.employee.Id, item.employee.EmployeeCode, item.employee.FullName,
                item.order.Id, item.order.Code, item.order.ProductName,
                item.operation.Id, item.operation.OperationNumber, item.operation.Name))
            .ToListAsync(cancellationToken);

        return AppResult<ProductionMonthlyMatrixResult>.Success(
            ProductionMonthlyMatrixBuilder.Build(fromDate, untilDate, request, rows));
    }
}

internal sealed record ProductionMonthlyMatrixRow(
    Guid Id, int Version, DateOnly WorkDate, ProductionEntryMode EntryMode,
    decimal HcQuantity, decimal TcQuantity, decimal TotalQuantity,
    string? Note, DateTimeOffset CreatedAt,
    Guid EmployeeId, string EmployeeCode, string EmployeeName,
    Guid OrderId, string OrderCode, string ProductName,
    Guid OperationId, int OperationNumber, string OperationName);
