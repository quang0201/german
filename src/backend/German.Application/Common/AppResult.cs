namespace German.Application.Common;

public sealed record AppError(string Code, string Message);

public class AppResult
{
    protected AppResult(bool isSuccess, AppError? error)
    {
        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }
    public AppError? Error { get; }

    public static AppResult Success() => new(true, null);

    public static AppResult Failure(string code, string message) =>
        new(false, new AppError(code, message));
}

public sealed class AppResult<T> : AppResult
{
    private AppResult(bool isSuccess, T? value, AppError? error)
        : base(isSuccess, error)
    {
        Value = value;
    }

    public T? Value { get; }

    public static AppResult<T> Success(T value) => new(true, value, null);

    public new static AppResult<T> Failure(string code, string message) =>
        new(false, default, new AppError(code, message));
}
