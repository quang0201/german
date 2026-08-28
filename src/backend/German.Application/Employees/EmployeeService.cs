using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Employees;
using German.Domain.Shifts;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Employees;

public sealed class EmployeeService(IGermanDbContext db)
{
    public async Task<IReadOnlyList<EmployeeDto>> ListAsync(
        CancellationToken cancellationToken,
        DateOnly? asOfDate = null)
    {
        var employees = await db.Employees.AsNoTracking()
            .OrderBy(x => x.EmployeeCode)
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
        {
            return [];
        }

        var date = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var employeeIds = employees.Select(x => x.Id).ToArray();
        var assignments = await db.EmployeeShiftAssignments.AsNoTracking()
            .Where(x => employeeIds.Contains(x.EmployeeId)
                && x.EffectiveFrom <= date
                && (x.EffectiveTo == null || x.EffectiveTo >= date))
            .OrderByDescending(x => x.EffectiveFrom)
            .ToListAsync(cancellationToken);
        var shiftIds = assignments.Select(x => x.ShiftTemplateId).Distinct().ToArray();
        var shifts = await db.ShiftTemplates.AsNoTracking()
            .Where(x => shiftIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        return employees.Select(employee =>
        {
            var assignment = assignments.FirstOrDefault(x => x.EmployeeId == employee.Id);
            var shift = assignment is not null && shifts.TryGetValue(assignment.ShiftTemplateId, out var template)
                ? new EmployeeCurrentShiftDto(
                    template.Id,
                    template.Name,
                    template.IsActive,
                    assignment.EffectiveFrom,
                    assignment.EffectiveTo)
                : null;
            return ToDto(employee, shift);
        }).ToList();
    }

    public async Task<AppResult<EmployeeDto>> CreateAsync(CreateEmployeeCommand command, CancellationToken cancellationToken)
    {
        var normalized = Normalize(command.EmployeeCode);
        if (normalized.Length == 0 || string.IsNullOrWhiteSpace(command.FullName))
        {
            return AppResult<EmployeeDto>.Failure("employee.invalid_input", "Mã nhân viên và họ tên là bắt buộc.");
        }

        if (!command.ShiftTemplateId.HasValue || !command.EffectiveFrom.HasValue)
        {
            return AppResult<EmployeeDto>.Failure("shift.effective_from_required", "Bộ ca HC và ngày hiệu lực là bắt buộc.");
        }

        if (await db.Employees.AnyAsync(x => x.EmployeeCode.ToUpper() == normalized, cancellationToken))
        {
            return AppResult<EmployeeDto>.Failure("employee.duplicate_code", "Mã nhân viên đã tồn tại.");
        }

        if (command.ShiftTemplateId.HasValue
            && !await db.ShiftTemplates.AnyAsync(x => x.Id == command.ShiftTemplateId.Value && x.IsActive, cancellationToken))
        {
            return AppResult<EmployeeDto>.Failure("shift.not_found", "Không tìm thấy bộ ca đang hoạt động.");
        }

        var employee = new Employee
        {
            EmployeeCode = command.EmployeeCode.Trim(),
            FullName = command.FullName.Trim()
        };
        db.Employees.Add(employee);

        if (command.ShiftTemplateId.HasValue)
        {
            db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
            {
                EmployeeId = employee.Id,
                ShiftTemplateId = command.ShiftTemplateId.Value,
                EffectiveFrom = command.EffectiveFrom!.Value
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EmployeeDto>.Success(ToDto(employee));
    }

    public async Task<AppResult<EmployeeDto>> UpdateAsync(Guid id, UpdateEmployeeCommand command, CancellationToken cancellationToken)
    {
        var employee = await db.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return AppResult<EmployeeDto>.Failure("employee.not_found", "Không tìm thấy nhân viên.");
        }

        var normalized = Normalize(command.EmployeeCode);
        if (normalized.Length == 0 || string.IsNullOrWhiteSpace(command.FullName))
        {
            return AppResult<EmployeeDto>.Failure("employee.invalid_input", "Mã nhân viên và họ tên là bắt buộc.");
        }

        if (await db.Employees.AnyAsync(x => x.Id != id && x.EmployeeCode.ToUpper() == normalized, cancellationToken))
        {
            return AppResult<EmployeeDto>.Failure("employee.duplicate_code", "Mã nhân viên đã tồn tại.");
        }

        employee.EmployeeCode = command.EmployeeCode.Trim();
        employee.FullName = command.FullName.Trim();
        if (command.IsActive)
        {
            employee.DeactivatedAt = null;
        }
        else if (employee.IsActive)
        {
            employee.DeactivatedAt = DateOnly.FromDateTime(DateTime.UtcNow);
        }
        employee.IsActive = command.IsActive;
        employee.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EmployeeDto>.Success(ToDto(employee));
    }

    public async Task<AppResult> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var employee = await db.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return AppResult.Failure("employee.not_found", "Không tìm thấy nhân viên.");
        }

        employee.IsActive = false;
        employee.DeactivatedAt ??= DateOnly.FromDateTime(DateTime.UtcNow);
        employee.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult.Success();
    }

    public async Task<AppResult<EmployeeShiftAssignment>> AssignShiftAsync(
        Guid employeeId,
        AssignShiftCommand command,
        CancellationToken cancellationToken)
    {
        var employee = await db.Employees.FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken);
        if (employee is null)
        {
            return AppResult<EmployeeShiftAssignment>.Failure("employee.not_found", "Không tìm thấy nhân viên.");
        }

        if (!employee.IsActive)
        {
            return AppResult<EmployeeShiftAssignment>.Failure("employee.inactive", "Nhân viên đã được tắt và không thể gán bộ ca mới.");
        }

        if (!await db.ShiftTemplates.AnyAsync(x => x.Id == command.ShiftTemplateId && x.IsActive, cancellationToken))
        {
            return AppResult<EmployeeShiftAssignment>.Failure("shift.not_found", "Không tìm thấy bộ ca đang hoạt động.");
        }

        var sameDate = await db.EmployeeShiftAssignments
            .FirstOrDefaultAsync(x => x.EmployeeId == employeeId && x.EffectiveFrom == command.EffectiveFrom, cancellationToken);
        if (sameDate is not null)
        {
            return AppResult<EmployeeShiftAssignment>.Failure("shift.assignment_conflict", "Nhân viên đã có cấu hình ca từ ngày hiệu lực này.");
        }

        var current = await db.EmployeeShiftAssignments
            .Where(x => x.EmployeeId == employeeId
                && x.EffectiveFrom < command.EffectiveFrom
                && (x.EffectiveTo == null || x.EffectiveTo >= command.EffectiveFrom))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);

        if (current is not null)
        {
            current.EffectiveTo = command.EffectiveFrom.AddDays(-1);
        }

        var next = await db.EmployeeShiftAssignments.AsNoTracking()
            .Where(x => x.EmployeeId == employeeId && x.EffectiveFrom > command.EffectiveFrom)
            .OrderBy(x => x.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);

        var assignment = new EmployeeShiftAssignment
        {
            EmployeeId = employeeId,
            ShiftTemplateId = command.ShiftTemplateId,
            EffectiveFrom = command.EffectiveFrom,
            EffectiveTo = next is null ? null : next.EffectiveFrom.AddDays(-1)
        };
        db.EmployeeShiftAssignments.Add(assignment);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EmployeeShiftAssignment>.Success(assignment);
    }

    private static EmployeeDto ToDto(Employee employee, EmployeeCurrentShiftDto? currentShift = null) =>
        new(employee.Id, employee.EmployeeCode, employee.FullName, employee.IsActive, employee.DeactivatedAt, currentShift);

    private static string Normalize(string value) => value?.Trim().ToUpperInvariant() ?? string.Empty;
}
