using German.Domain.Auditing;

namespace German.Application.Auditing;

public sealed record AuditLogListItemDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    AuditAction Action,
    DateTimeOffset PerformedAt,
    Guid PerformedByUserId,
    string PerformedByUsername,
    string? PerformedByEmployeeCode,
    string? PerformedByEmployeeName,
    string? BeforeJson,
    string? AfterJson);
