using System.Text.Json;
using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auditing;
using German.Domain.Auth;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionEntries;

public sealed class ProductionEntryService(IGermanDbContext db)
{
    public async Task<AppResult<ProductionEntryDto>> CreateAsync(
        CurrentActor actor,
        CreateProductionEntryCommand command,
        CancellationToken cancellationToken)
    {
        var authorization = ValidateCreateAuthorization(actor, command.EmployeeId);
        if (!authorization.IsSuccess)
        {
            return AppResult<ProductionEntryDto>.Failure(authorization.Error!.Code, authorization.Error.Message);
        }

        var validation = await ValidateReferencesAsync(
            actor, command.EmployeeId, command.ProductionOrderId, command.ProductionOperationId, cancellationToken);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductionEntryDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var calculation = await CalculateAsync(
            command.WorkDate,
            command.EmployeeId,
            command.EntryMode,
            command.Shift1Quantity,
            command.Shift2Quantity,
            command.DirectHcQuantity,
            command.DirectTcQuantity,
            command.TotalInputQuantity,
            command.OvertimeHours,
            command.OvertimeQuantity,
            command.WorkStart,
            command.WorkEnd,
            cancellationToken);

        if (!calculation.IsSuccess)
        {
            return AppResult<ProductionEntryDto>.Failure(calculation.Error!.Code, calculation.Error.Message);
        }

        var now = DateTimeOffset.UtcNow;
        var entry = new ProductionEntry
        {
            WorkDate = command.WorkDate,
            EmployeeId = command.EmployeeId,
            ProductionOrderId = command.ProductionOrderId,
            ProductionOperationId = command.ProductionOperationId,
            EntryMode = command.EntryMode,
            Shift1Quantity = command.Shift1Quantity,
            Shift2Quantity = command.Shift2Quantity,
            DirectHcQuantity = command.DirectHcQuantity,
            DirectTcQuantity = command.DirectTcQuantity,
            TotalInputQuantity = command.TotalInputQuantity,
            OvertimeHours = command.OvertimeHours,
            OvertimeQuantity = command.OvertimeQuantity,
            WorkStart = command.WorkStart,
            WorkEnd = command.WorkEnd,
            HcQuantity = calculation.Value!.Hc,
            TcQuantity = calculation.Value.Tc,
            TotalQuantity = calculation.Value.Total,
            Note = NormalizeNote(command.Note),
            SubmittedByUserId = actor.UserId,
            CreatedAt = now,
            UpdatedAt = now,
            Version = 1
        };

        db.ProductionEntries.Add(entry);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionEntryDto>.Success(ToDto(entry));
    }

    public async Task<AppResult<ProductionEntryDto>> UpdateAsync(
        CurrentActor actor,
        Guid entryId,
        int expectedVersion,
        UpdateProductionEntryCommand command,
        CancellationToken cancellationToken)
    {
        if (actor.Role == UserRole.Worker)
        {
            return AppResult<ProductionEntryDto>.Failure(
                "production_entry.update_forbidden",
                "Công nhân không được sửa sản lượng sau khi nộp.");
        }

        var entry = await db.ProductionEntries.FirstOrDefaultAsync(x => x.Id == entryId, cancellationToken);
        if (entry is null)
        {
            return AppResult<ProductionEntryDto>.Failure("production_entry.not_found", "Không tìm thấy sản lượng.");
        }

        if (entry.Version != expectedVersion)
        {
            return AppResult<ProductionEntryDto>.Failure(
                "production_entry.version_conflict",
                "Dữ liệu đã được thay đổi bởi người khác. Hãy tải lại trước khi sửa.");
        }

        var validation = await ValidateReferencesAsync(
            actor, command.EmployeeId, command.ProductionOrderId, command.ProductionOperationId, cancellationToken);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductionEntryDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var calculation = await CalculateAsync(
            command.WorkDate,
            command.EmployeeId,
            command.EntryMode,
            command.Shift1Quantity,
            command.Shift2Quantity,
            command.DirectHcQuantity,
            command.DirectTcQuantity,
            command.TotalInputQuantity,
            command.OvertimeHours,
            command.OvertimeQuantity,
            command.WorkStart,
            command.WorkEnd,
            cancellationToken);

        if (!calculation.IsSuccess)
        {
            return AppResult<ProductionEntryDto>.Failure(calculation.Error!.Code, calculation.Error.Message);
        }

        var beforeJson = JsonSerializer.Serialize(entry);

        entry.WorkDate = command.WorkDate;
        entry.EmployeeId = command.EmployeeId;
        entry.ProductionOrderId = command.ProductionOrderId;
        entry.ProductionOperationId = command.ProductionOperationId;
        entry.EntryMode = command.EntryMode;
        entry.Shift1Quantity = command.Shift1Quantity;
        entry.Shift2Quantity = command.Shift2Quantity;
        entry.DirectHcQuantity = command.DirectHcQuantity;
        entry.DirectTcQuantity = command.DirectTcQuantity;
        entry.TotalInputQuantity = command.TotalInputQuantity;
        entry.OvertimeHours = command.OvertimeHours;
        entry.OvertimeQuantity = command.OvertimeQuantity;
        entry.WorkStart = command.WorkStart;
        entry.WorkEnd = command.WorkEnd;
        entry.HcQuantity = calculation.Value!.Hc;
        entry.TcQuantity = calculation.Value.Tc;
        entry.TotalQuantity = calculation.Value.Total;
        entry.Note = NormalizeNote(command.Note);
        entry.UpdatedAt = DateTimeOffset.UtcNow;
        entry.Version += 1;

        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(ProductionEntry),
            EntityId = entry.Id,
            Action = AuditAction.Update,
            PerformedByUserId = actor.UserId,
            PerformedAt = DateTimeOffset.UtcNow,
            BeforeJson = beforeJson,
            AfterJson = JsonSerializer.Serialize(entry)
        });

        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionEntryDto>.Success(ToDto(entry));
    }

    public async Task<AppResult> DeleteAsync(
        CurrentActor actor,
        Guid entryId,
        int expectedVersion,
        CancellationToken cancellationToken)
    {
        if (actor.Role == UserRole.Worker)
        {
            return AppResult.Failure(
                "production_entry.delete_forbidden",
                "Công nhân không được xóa sản lượng sau khi nộp.");
        }

        var entry = await db.ProductionEntries.FirstOrDefaultAsync(x => x.Id == entryId, cancellationToken);
        if (entry is null)
        {
            return AppResult.Failure("production_entry.not_found", "Không tìm thấy sản lượng.");
        }

        if (entry.Version != expectedVersion)
        {
            return AppResult.Failure(
                "production_entry.version_conflict",
                "Dữ liệu đã được thay đổi bởi người khác. Hãy tải lại trước khi xóa.");
        }

        var beforeJson = JsonSerializer.Serialize(entry);
        entry.IsDeleted = true;
        entry.DeletedAt = DateTimeOffset.UtcNow;
        entry.DeletedByUserId = actor.UserId;
        entry.UpdatedAt = DateTimeOffset.UtcNow;
        entry.Version += 1;

        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(ProductionEntry),
            EntityId = entry.Id,
            Action = AuditAction.Delete,
            PerformedByUserId = actor.UserId,
            PerformedAt = DateTimeOffset.UtcNow,
            BeforeJson = beforeJson,
            AfterJson = JsonSerializer.Serialize(entry)
        });

        await db.SaveChangesAsync(cancellationToken);
        return AppResult.Success();
    }

    private static AppResult ValidateCreateAuthorization(CurrentActor actor, Guid employeeId)
    {
        if (actor.Role == UserRole.Worker && actor.EmployeeId != employeeId)
        {
            return AppResult.Failure(
                "production_entry.forbidden_employee",
                "Công nhân chỉ được nộp sản lượng cho chính mình.");
        }

        return AppResult.Success();
    }

    private async Task<AppResult> ValidateReferencesAsync(
        CurrentActor actor,
        Guid employeeId,
        Guid orderId,
        Guid operationId,
        CancellationToken cancellationToken)
    {
        var employee = await db.Employees.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken);
        if (employee is null || !employee.IsActive)
        {
            return AppResult.Failure("production_entry.employee_not_found", "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
        }

        var order = await db.ProductionOrders.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == orderId, cancellationToken);
        if (order is null)
        {
            return AppResult.Failure("production_entry.order_not_found", "Không tìm thấy mã sản xuất.");
        }

        if (actor.Role == UserRole.Worker && order.Status != ProductionOrderStatus.InProduction)
        {
            return AppResult.Failure(
                "production_entry.order_not_in_production",
                "Công nhân chỉ được nộp vào mã đang sản xuất.");
        }

        var operation = await db.ProductionOperations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == operationId, cancellationToken);
        if (operation is null || operation.ProductionOrderId != orderId)
        {
            return AppResult.Failure(
                "production_entry.operation_mismatch",
                "Công đoạn không thuộc mã sản xuất đã chọn.");
        }

        if (actor.Role == UserRole.Worker && !operation.IsActive)
        {
            return AppResult.Failure("production_entry.operation_inactive", "Công đoạn đã ngừng sử dụng.");
        }

        return AppResult.Success();
    }

    private async Task<AppResult<ProductionCalculationResult>> CalculateAsync(
        DateOnly workDate,
        Guid employeeId,
        ProductionEntryMode entryMode,
        decimal? shift1Quantity,
        decimal? shift2Quantity,
        decimal? directHcQuantity,
        decimal? directTcQuantity,
        decimal? totalInputQuantity,
        decimal? overtimeHours,
        decimal? overtimeQuantity,
        TimeOnly? workStart,
        TimeOnly? workEnd,
        CancellationToken cancellationToken)
    {
        if (workStart.HasValue && workEnd.HasValue && workEnd.Value <= workStart.Value)
        {
            return AppResult<ProductionCalculationResult>.Failure(
                "production_entry.invalid_work_time",
                "Giờ kết thúc phải sau giờ bắt đầu.");
        }

        var hcHours = 0m;
        if (NeedsConfiguredHcHours(entryMode, overtimeHours, overtimeQuantity))
        {
            var hoursResult = await ResolveHcHoursAsync(employeeId, workDate, cancellationToken);
            if (!hoursResult.IsSuccess)
            {
                return AppResult<ProductionCalculationResult>.Failure(hoursResult.Error!.Code, hoursResult.Error.Message);
            }

            hcHours = hoursResult.Value;
        }

        try
        {
            var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
                entryMode,
                hcHours,
                shift1Quantity,
                shift2Quantity,
                directHcQuantity,
                directTcQuantity,
                totalInputQuantity,
                overtimeHours,
                overtimeQuantity));
            return AppResult<ProductionCalculationResult>.Success(result);
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return AppResult<ProductionCalculationResult>.Failure(
                "production_entry.invalid_input",
                exception.Message);
        }
    }

    private async Task<AppResult<decimal>> ResolveHcHoursAsync(
        Guid employeeId,
        DateOnly workDate,
        CancellationToken cancellationToken)
    {
        var assignment = await db.EmployeeShiftAssignments.AsNoTracking()
            .Where(x => x.EmployeeId == employeeId
                && x.EffectiveFrom <= workDate
                && (x.EffectiveTo == null || x.EffectiveTo >= workDate))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);

        if (assignment is null)
        {
            return AppResult<decimal>.Failure(
                "production_entry.invalid_shift",
                "Không có bộ ca HC hiệu lực cho nhân viên tại ngày đã chọn.");
        }

        var periods = await db.ShiftPeriods.AsNoTracking()
            .Where(x => x.ShiftTemplateId == assignment.ShiftTemplateId)
            .ToListAsync(cancellationToken);

        if (periods.Count == 0 || periods.Any(x => x.EndTime <= x.StartTime))
        {
            return AppResult<decimal>.Failure(
                "production_entry.invalid_shift",
                "Bộ ca HC không có khung giờ hợp lệ.");
        }

        var totalHours = periods.Sum(x => (decimal)(x.EndTime - x.StartTime).TotalHours);
        if (totalHours <= 0m)
        {
            return AppResult<decimal>.Failure(
                "production_entry.invalid_shift",
                "Tổng số giờ HC của bộ ca phải lớn hơn 0.");
        }

        return AppResult<decimal>.Success(totalHours);
    }

    private static bool NeedsConfiguredHcHours(
        ProductionEntryMode mode,
        decimal? overtimeHours,
        decimal? overtimeQuantity)
    {
        var hasOvertimeHours = (overtimeHours ?? 0m) > 0m;
        return mode switch
        {
            ProductionEntryMode.ByShift => hasOvertimeHours && !overtimeQuantity.HasValue,
            ProductionEntryMode.TotalWithOvertime => hasOvertimeHours,
            _ => false
        };
    }

    private static string? NormalizeNote(string? note) =>
        string.IsNullOrWhiteSpace(note) ? null : note.Trim();

    private static ProductionEntryDto ToDto(ProductionEntry entry) =>
        new(
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
            entry.UpdatedAt);
}
