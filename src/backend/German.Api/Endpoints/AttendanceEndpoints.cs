using German.Api.Contracts.Attendance;
using German.Application.Attendance;

namespace German.Api.Endpoints;

public static class AttendanceEndpoints
{
    public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/attendance").RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/monthly", async (
            int year,
            int month,
            Guid? employeeId,
            string? employeeCursor,
            int? employeeLimit,
            AttendanceService service,
            CancellationToken ct) =>
        {
            try
            {
                return Results.Ok(await service.GetMonthAsync(new AttendanceMonthlyQuery(year, month, employeeId, employeeCursor, employeeLimit ?? 20), ct));
            }
            catch (ArgumentOutOfRangeException exception)
            {
                var isLimit = exception.ParamName == "limit";
                return Results.BadRequest(new
                {
                    code = isLimit ? "attendance.invalid_employee_limit" : "attendance.invalid_month",
                    message = isLimit ? "Số nhân viên mỗi lần tải phải từ 1 đến 100." : "Tháng chấm công không hợp lệ."
                });
            }
            catch (ArgumentException)
            {
                return Results.BadRequest(new { code = "attendance.invalid_employee_cursor", message = "Cursor nhân viên không hợp lệ." });
            }
        });

        group.MapPut("/monthly", async (
            SaveAttendanceMonthRequest request,
            AttendanceService service,
            CancellationToken ct) =>
        {
            var command = new SaveAttendanceMonthCommand(
                request.Year,
                request.Month,
                request.Days.Select(day => new AttendanceDayInput(
                    day.EmployeeId,
                    day.WorkDate,
                    day.OvertimeHours,
                    day.Shifts.Select(shift => new AttendanceShiftInput(
                        shift.SlotNumber,
                        shift.Kind,
                        shift.WorkedHours)).ToList())).ToList());
            var result = await service.SaveMonthAsync(command, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResultMapper.Error(result.Error!);
        });

        return endpoints;
    }
}
