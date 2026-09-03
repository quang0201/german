namespace German.Application.Reports;

public interface IProductionReportExporter
{
    byte[] Export(ProductionReportData report);
}
