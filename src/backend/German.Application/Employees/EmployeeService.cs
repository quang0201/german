using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Employees;
using German.Domain.Shifts;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Employees;

public sealed class EmployeeService(IGermanDbContext db)
{
    public async Task<IReadOnlyList<EmployeeDto>> ListAsync(CancellationToken cancellationToken)
    {
        return await db.Employees.AsNoTracking()
            .OrderBy(x => x.EmployeeCode)
            .Select(x => new EmployeeDto(x.Id, x.EmployeeCode, x.FullName, x.IsActive))
            .ToListAsync(cancellationToken);
    }

    public async Task<AppResult<EmployeeDto>> CreateAsync(CreateEmployeeCommand command, CancellationToken cancellationToken)
    {
        var normalized = Normalize(command.EmployeeCode);
        if (normalized.Length == 0 || string.IsNullOrWhiteSpace(command.FullName))
        {
            return AppResult<EmployeeDto>.Failure("employee.invalid_input", "Mã nhân viên và họ tên là bắt buộc.");
        }

        if (await db.Employees.AnyAsync(x => x.EmployeeCode.ToUpper() == normalized, cancellationToken))
        {
            return AppResult<EmployeeDto>.Failure("employee.duplicate_code", "Mã nhân viên đã tồn tại.");
        }

        var employee = new Employee
        {
            EmployeeCode = command.EmployeeCode.Trim(),
            FullName = command.FullName.Trim()
        };
        db.Employees.Add(employee);
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
        employee.IsActive = command.IsActive;
        employee.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EmployeeDto>.Success(ToDto(employee));
    }

    public async Task<AppResult<EmployeeShiftAssignment>> AssignShiftAsync(
        Guid employeeId,
        AssignShiftCommand command,
        CancellationToken cancellationToken)
    {
        if (!await db.Employees.AnyAsync(x => x.Id == employeeId, cancellationToken))
        {
            return AppResult<EmployeeShiftAssignment>.Failure("employee.not_found", "Không tìm thấy nhân viên.");
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

    private static EmployeeDto ToDto(Employee employee) =>
        new(employee.Id, employee.EmployeeCode, employee.FullName, employee.IsActive);

    private static string Normalize(string value) => value?.Trim().ToUpperInvariant() ?? string.Empty;
}
