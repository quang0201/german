namespace German.Api.Contracts.Common;

public sealed record ApiErrorResponse(string Code, string Message, object? Errors = null);
