using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionEntries;

public sealed class ProductionEntryBatchDirectService(IGermanDbContext db)
{
    public async Task<AppResult<CreateProductionEntryBatchDirectResult>> CreateAsync(
        CurrentActor actor,
        CreateProductionEntryBatchDirectCommand command,
        CancellationToken cancellationToken)
    {
        if (actor.Role == UserRole.Worker)
        {
            return Failure("production_entry.batch_forbidden", "Chỉ quản lý hoặc quản trị viên được nhập nhiều công đoạn.");
        }

        if (command.Items is null || command.Items.Count == 0)
        {
            return Failure("production_entry.batch_empty", "Hãy chọn ít nhất một công đoạn.");
        }

        var operationIds = command.Items.Select(item => item.ProductionOperationId).ToArray();
        if (operationIds.Distinct().Count() != operationIds.Length)
        {
            return Failure("production_entry.batch_duplicate_operation", "Một công đoạn không được xuất hiện nhiều lần trong cùng lần nhập.");
        }

        var employee = await db.Employees.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == command.EmployeeId, cancellationToken);
        if (employee is null || !employee.IsActive)
        {
            return Failure("production_entry.employee_not_found", "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
        }

        var order = await db.ProductionOrders.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == command.ProductionOrderId, cancellationToken);
        if (order is null)
        {
            return Failure("production_entry.order_not_found", "Không tìm thấy mã sản xuất.");
        }

        if (order.Status != ProductionOrderStatus.InProduction)
        {
            return Failure("production_entry.order_not_in_production", "Chỉ được nhập nhiều công đoạn vào mã đang sản xuất.");
        }

        var operations = await db.ProductionOperations.AsNoTracking()
            .Where(item => operationIds.Contains(item.Id))
            .ToListAsync(cancellationToken);
        if (operations.Count != operationIds.Length
            || operations.Any(item => item.ProductionOrderId != command.ProductionOrderId))
        {
            return Failure("production_entry.operation_mismatch", "Có công đoạn không thuộc mã sản xuất đã chọn.");
        }

        if (operations.Any(item => !item.IsActive))
        {
            return Failure("production_entry.operation_inactive", "Có công đoạn đã ngừng sử dụng.");
        }

        var conflictingIds = await db.ProductionEntries.AsNoTracking()
            .Where(item => item.WorkDate == command.WorkDate
                && item.EmployeeId == command.EmployeeId
                && item.ProductionOrderId == command.ProductionOrderId
                && (item.HcQuantity != 0m || item.TcQuantity != 0m || item.TotalQuantity != 0m)
                && operationIds.Contains(item.ProductionOperationId))
            .Select(item => item.ProductionOperationId)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (conflictingIds.Count > 0)
        {
            var numbers = operations
                .Where(item => conflictingIds.Contains(item.Id))
                .OrderBy(item => item.OperationNumber)
                .Select(item => $"CĐ{item.OperationNumber}");
            return Failure(
                "production_entry.batch_conflict",
                $"Đã có sản lượng tại {string.Join(", ", numbers)}. Hãy chỉnh sửa trực tiếp trên ô tương ứng.");
        }

        var calculated = new List<(CreateProductionEntryBatchDirectItem Item, ProductionCalculationResult Result)>();
        foreach (var item in command.Items)
        {
            try
            {
                var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
                    ProductionEntryMode.Direct,
                    0m,
                    DirectHcQuantity: item.DirectHcQuantity,
                    DirectTcQuantity: item.DirectTcQuantity));
                calculated.Add((item, result));
            }
            catch (ArgumentOutOfRangeException exception)
            {
                return Failure("production_entry.invalid_input", exception.Message);
            }
        }

        var now = DateTimeOffset.UtcNow;
        var entries = calculated.Select(item => new ProductionEntry
        {
            WorkDate = command.WorkDate,
            EmployeeId = command.EmployeeId,
            ProductionOrderId = command.ProductionOrderId,
            ProductionOperationId = item.Item.ProductionOperationId,
            EntryMode = ProductionEntryMode.Direct,
            DirectHcQuantity = item.Item.DirectHcQuantity,
            DirectTcQuantity = item.Item.DirectTcQuantity,
            HcQuantity = item.Result.Hc,
            TcQuantity = item.Result.Tc,
            TotalQuantity = item.Result.Total,
            Note = NormalizeNote(item.Item.Note),
            SubmittedByUserId = actor.UserId,
            CreatedAt = now,
            UpdatedAt = now,
            Version = 1
        }).ToList();

        db.ProductionEntries.AddRange(entries);
        await db.SaveChangesAsync(cancellationToken);

        return AppResult<CreateProductionEntryBatchDirectResult>.Success(
            new CreateProductionEntryBatchDirectResult(entries.Count, entries.Select(ToDto).ToList()));
    }

    private static AppResult<CreateProductionEntryBatchDirectResult> Failure(string code, string message) =>
        AppResult<CreateProductionEntryBatchDirectResult>.Failure(code, message);

    private static string? NormalizeNote(string? note) =>
        string.IsNullOrWhiteSpace(note) ? null : note.Trim();

    private static ProductionEntryDto ToDto(ProductionEntry entry) => new(
        entry.Id,
        entry.Version,
        entry.WorkDate,
        entry.EmployeeId,
        entry.ProductionOrderId,
        entry.ProductionOperationId,
        entry.EntryMode,
        entry.Shift1Quantity,
        entry.Shift2Quantity,
        entry.DirectHcQuantity,
        entry.DirectTcQuantity,
        entry.TotalInputQuantity,
        entry.OvertimeHours,
        entry.OvertimeQuantity,
        entry.WorkStart,
        entry.WorkEnd,
        entry.HcQuantity,
        entry.TcQuantity,
        entry.TotalQuantity,
        entry.Note,
        entry.CreatedAt,
        entry.UpdatedAt,
        entry.HcHours);
}
