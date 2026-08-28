namespace German.Application.Employees;

public sealed record EmployeeDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    bool IsActive,
    DateOnly? DeactivatedAt,
    EmployeeCurrentShiftDto? CurrentShift);

public sealed record EmployeeCurrentShiftDto(
    Guid ShiftTemplateId,
    string ShiftTemplateName,
    bool ShiftTemplateIsActive,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo);

public sealed record CreateEmployeeCommand(
    string EmployeeCode,
    string FullName,
    Guid? ShiftTemplateId = null,
    DateOnly? EffectiveFrom = null);
public sealed record UpdateEmployeeCommand(string EmployeeCode, string FullName, bool IsActive);
public sealed record AssignShiftCommand(Guid ShiftTemplateId, DateOnly EffectiveFrom);
