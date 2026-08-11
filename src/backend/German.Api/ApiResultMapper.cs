using German.Api.Contracts.Common;
using German.Application.Common;

namespace German.Api;

public static class ApiResultMapper
{
    public static IResult Error(AppError error)
    {
        var status = error.Code switch
        {
            "auth.invalid_credentials" => StatusCodes.Status401Unauthorized,
            "production_entry.forbidden_employee" => StatusCodes.Status403Forbidden,
            "production_entry.update_forbidden" => StatusCodes.Status403Forbidden,
            "production_entry.delete_forbidden" => StatusCodes.Status403Forbidden,
            "production_entry.not_found" => StatusCodes.Status404NotFound,
            "production_entry.employee_not_found" => StatusCodes.Status404NotFound,
            "production_entry.order_not_found" => StatusCodes.Status404NotFound,
            "production_entry.version_conflict" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };

        return Results.Json(new ApiErrorResponse(error.Code, error.Message), statusCode: status);
    }
}
