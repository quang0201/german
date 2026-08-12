using German.Domain.Auditing;

namespace German.Application.Auditing;

public sealed record AuditLogListQuery(
    DateOnly? FromDate,
    DateOnly? UntilDate,
    string? EntityType,
    Guid? EntityId,
    AuditAction? Action,
    Guid? PerformedByUserId,
    int? Page,
    int? PageSize);
