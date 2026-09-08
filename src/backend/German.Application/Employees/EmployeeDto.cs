using German.Domain.Employees;

namespace German.Application.Employees;

public sealed record EmployeeDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    bool IsActive,
    EmployeeCompensationType CompensationType = EmployeeCompensationType.PieceRate,
    Guid? CurrentShiftTemplateId = null,
    string? CurrentShiftTemplateName = null,
    DateOnly? CurrentShiftEffectiveFrom = null,
    DateOnly? DeactivatedAt = null);

public sealed record CreateEmployeeCommand(
    string EmployeeCode,
    string FullName,
    Guid? ShiftTemplateId = null,
    DateOnly? EffectiveFrom = null,
    EmployeeCompensationType CompensationType = EmployeeCompensationType.PieceRate);
public sealed record UpdateEmployeeCommand(
    string EmployeeCode,
    string FullName,
    bool IsActive,
    EmployeeCompensationType? CompensationType = null);
public sealed record AssignShiftCommand(Guid ShiftTemplateId, DateOnly EffectiveFrom);
