namespace German.Api.Contracts.Employees;

using German.Domain.Employees;

public sealed record CreateEmployeeRequest(
    string EmployeeCode,
    string FullName,
    Guid? ShiftTemplateId = null,
    DateOnly? EffectiveFrom = null,
    EmployeeCompensationType? CompensationType = null);
public sealed record UpdateEmployeeRequest(
    string EmployeeCode,
    string FullName,
    bool IsActive,
    EmployeeCompensationType? CompensationType = null,
    DateOnly? DeactivatedAt = null);
public sealed record AssignShiftRequest(Guid ShiftTemplateId, DateOnly EffectiveFrom);
