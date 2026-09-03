namespace German.Application.Shifts;

public sealed record ShiftPeriodInput(string Name, TimeOnly StartTime, TimeOnly EndTime, int SortOrder);
public sealed record CreateShiftTemplateCommand(string Name, IReadOnlyList<ShiftPeriodInput> Periods);
public sealed record UpdateShiftTemplateCommand(string Name, bool IsActive, IReadOnlyList<ShiftPeriodInput> Periods);

public sealed record ShiftPeriodDto(Guid Id, string Name, TimeOnly StartTime, TimeOnly EndTime, int SortOrder);
public sealed record ShiftTemplateDto(Guid Id, string Name, bool IsActive, decimal TotalHours, IReadOnlyList<ShiftPeriodDto> Periods);
