namespace German.Application.Reports;

public interface IProductionMonthlyReportExporter
{
    byte[] Export(ProductionMonthlyOperationSummaryReport report);
}
