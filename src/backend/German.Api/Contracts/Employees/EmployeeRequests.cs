namespace German.Api.Contracts.Employees;

public sealed record CreateEmployeeRequest(string EmployeeCode, string FullName);
public sealed record UpdateEmployeeRequest(string EmployeeCode, string FullName, bool IsActive);
public sealed record AssignShiftRequest(Guid ShiftTemplateId, DateOnly EffectiveFrom);
