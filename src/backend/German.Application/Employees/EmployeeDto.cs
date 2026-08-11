namespace German.Application.Employees;

public sealed record EmployeeDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    bool IsActive);

public sealed record CreateEmployeeCommand(string EmployeeCode, string FullName);
public sealed record UpdateEmployeeCommand(string EmployeeCode, string FullName, bool IsActive);
public sealed record AssignShiftCommand(Guid ShiftTemplateId, DateOnly EffectiveFrom);
