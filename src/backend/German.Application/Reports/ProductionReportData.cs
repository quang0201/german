namespace German.Application.Reports;

public sealed record ProductionReportData(
    DateOnly FromDate,
    DateOnly UntilDate,
    IReadOnlyList<ProductionReportRow> Rows)
{
    public string EmployeeLabel { get; init; } = "Tất cả";
    public string OrderLabel { get; init; } = "Tất cả";
    public string OperationLabel { get; init; } = "Tất cả";
    public string SearchLabel { get; init; } = "Tất cả";
    public string FinalMetricLabel { get; init; } = "Tổng lượt công đoạn";
    public ProductionReportSummary Summary { get; init; } = new(0, 0, 0m, 0m, 0m);
    public IReadOnlyList<ProductionReportDaySummary> ByDay { get; init; } = [];
    public IReadOnlyList<ProductionReportEmployeeSummary> ByEmployee { get; init; } = [];
}
