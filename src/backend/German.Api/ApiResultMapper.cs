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
            "production_entry.history_forbidden" => StatusCodes.Status403Forbidden,
            "production_entry.read_forbidden" => StatusCodes.Status403Forbidden,
            "production_entry.update_forbidden" => StatusCodes.Status403Forbidden,
            "production_entry.delete_forbidden" => StatusCodes.Status403Forbidden,
            "production_entry.batch_forbidden" => StatusCodes.Status403Forbidden,
            "shift.forbidden_employee" => StatusCodes.Status403Forbidden,
            "production_entry.not_found" => StatusCodes.Status404NotFound,
            "production_entry.employee_not_found" => StatusCodes.Status404NotFound,
            "production_entry.order_not_found" => StatusCodes.Status404NotFound,
            "production_operation.not_found" => StatusCodes.Status404NotFound,
            "user_account.employee_not_found" => StatusCodes.Status404NotFound,
            "shift.not_found" => StatusCodes.Status404NotFound,
            "production_entry.version_conflict" => StatusCodes.Status409Conflict,
            "production_entry.cell_conflict" => StatusCodes.Status409Conflict,
            "production_entry.batch_conflict" => StatusCodes.Status409Conflict,
            "user_account.duplicate_username" => StatusCodes.Status409Conflict,
            "user_account.employee_already_linked" => StatusCodes.Status409Conflict,
            "production_order.duplicate_code" => StatusCodes.Status409Conflict,
            "production_operation.duplicate_number" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };

        return Results.Json(new ApiErrorResponse(error.Code, error.Message), statusCode: status);
    }
}
