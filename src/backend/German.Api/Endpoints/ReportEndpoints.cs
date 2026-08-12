using German.Application.Reports;

namespace German.Api.Endpoints;

public static class ReportEndpoints
{
    private const string XlsxContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/reports")
            .RequireAuthorization("ManagerOrAdmin");

        group.MapGet("/production/export.xlsx", ExportProductionAsync);
        return endpoints;
    }

    private static async Task<IResult> ExportProductionAsync(
        DateOnly? fromDate,
        DateOnly? untilDate,
        Guid? employeeId,
        Guid? orderId,
        Guid? operationId,
        ProductionReportService service,
        IProductionReportExporter exporter,
        CancellationToken cancellationToken)
    {
        var result = await service.BuildAsync(
            new ProductionReportFilter(fromDate, untilDate, employeeId, orderId, operationId),
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
