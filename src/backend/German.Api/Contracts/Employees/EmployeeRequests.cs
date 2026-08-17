namespace German.Api.Contracts.Employees;

public sealed record CreateEmployeeRequest(
    string EmployeeCode,
    string FullName,
    Guid? ShiftTemplateId = null,
    DateOnly? EffectiveFrom = null);
public sealed record UpdateEmployeeRequest(string EmployeeCode, string FullName, bool IsActive);
public sealed record AssignShiftRequest(Guid ShiftTemplateId, DateOnly EffectiveFrom);
