namespace German.Application.Reports;

public sealed record ProductionReportData(
    DateOnly FromDate,
    DateOnly UntilDate,
    IReadOnlyList<ProductionReportRow> Rows);
