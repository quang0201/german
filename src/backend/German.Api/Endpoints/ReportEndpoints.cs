using German.Application.Reports;
using German.Application.Common;
using System.Globalization;

namespace German.Api.Endpoints;

public static class ReportEndpoints
{
    private const string XlsxContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/reports")
            .RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/production/summary", GetProductionSummaryAsync);
        group.MapGet("/production/monthly-summary", GetProductionMonthlySummaryAsync);
        group.MapGet("/production/monthly-summary/export.xlsx", ExportProductionMonthlyAsync);
        group.MapGet("/production/export.xlsx", ExportProductionAsync);
        return endpoints;
    }

    private static async Task<IResult> GetProductionMonthlySummaryAsync(
        Guid orderId,
        string? fromMonth,
        string? untilMonth,
        ProductionReportService service,
        CancellationToken cancellationToken)
    {
        if (!TryParseMonth(fromMonth, out var rangeFrom)
            || !TryParseMonth(untilMonth, out var rangeUntil))
        {
            return ApiResultMapper.Error(new AppError(
                "reports.invalid_month",
                "Tháng phải có định dạng YYYY-MM."));
        }

        var result = await service.BuildMonthlyOperationSummaryAsync(
            orderId,
            rangeFrom,
            rangeUntil.AddMonths(1).AddDays(-1),
            cancellationToken);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : ApiResultMapper.Error(result.Error!);
    }

    private static bool TryParseMonth(string? value, out DateOnly month)
    {
        return DateOnly.TryParseExact(
            value,
            "yyyy-MM",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out month)
            && month.Day == 1;
    }

    private static async Task<IResult> ExportProductionMonthlyAsync(
        Guid orderId,
        string? fromMonth,
        string? untilMonth,
        ProductionReportService service,
        IProductionMonthlyReportExporter exporter,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (!TryParseMonth(fromMonth, out var rangeFrom)
            || !TryParseMonth(untilMonth, out var rangeUntil))
        {
            return ApiResultMapper.Error(new AppError(
                "reports.invalid_month",
                "Tháng phải có định dạng YYYY-MM."));
        }

        var result = await service.BuildMonthlyOperationSummaryAsync(
            orderId,
            rangeFrom,
            rangeUntil.AddMonths(1).AddDays(-1),
            cancellationToken);
        if (!result.IsSuccess)
        {
            return ApiResultMapper.Error(result.Error!);
        }

        var bytes = exporter.Export(result.Value!);
        var fileName = $"bao-cao-san-luong-theo-thang_{rangeFrom:yyyyMM}_{rangeUntil:yyyyMM}.xlsx";
        SetNoStoreHeaders(httpContext);
        return Results.File(bytes, XlsxContentType, fileName);
    }

    private static void SetNoStoreHeaders(HttpContext httpContext)
    {
        httpContext.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        httpContext.Response.Headers.Pragma = "no-cache";
        httpContext.Response.Headers.Expires = "0";
    }

    private static async Task<IResult> GetProductionSummaryAsync(
        Guid orderId,
        DateOnly? fromDate,
        DateOnly? untilDate,
        ProductionReportService service,
        CancellationToken cancellationToken)
    {
        var result = await service.BuildOperationSummaryAsync(
            orderId,
            fromDate,
            untilDate,
            cancellationToken);

        return result.IsSuccess
            ? Results.Ok(result.Value)
            : ApiResultMapper.Error(result.Error!);
    }

    private static async Task<IResult> ExportProductionAsync(
        DateOnly? fromDate,
        DateOnly? untilDate,
        Guid? employeeId,
        Guid? orderId,
        Guid? operationId,
        string? search,
        bool? excludeSundays,
        ProductionReportService service,
        IProductionReportExporter exporter,
        CancellationToken cancellationToken)
    {
        var result = await service.BuildAsync(
            new ProductionReportFilter(
                fromDate,
                untilDate,
                employeeId,
                orderId,
                operationId,
                search,
                excludeSundays ?? false),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return ApiResultMapper.Error(result.Error!);
        }

        var report = result.Value!;
        var bytes = exporter.Export(report);
        var fileName = $"san-luong_{report.FromDate:yyyyMMdd}_{report.UntilDate:yyyyMMdd}.xlsx";
        return Results.File(bytes, XlsxContentType, fileName);
    }
}
