namespace German.Api.Contracts.Shifts;

public sealed record ShiftPeriodRequest(string Name, TimeOnly StartTime, TimeOnly EndTime, int SortOrder);
public sealed record CreateShiftTemplateRequest(string Name, IReadOnlyList<ShiftPeriodRequest> Periods);
public sealed record UpdateShiftTemplateRequest(string Name, bool IsActive, IReadOnlyList<ShiftPeriodRequest> Periods);
