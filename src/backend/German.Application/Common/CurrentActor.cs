using German.Domain.Auth;

namespace German.Application.Common;

public sealed record CurrentActor(Guid UserId, UserRole Role, Guid? EmployeeId);
