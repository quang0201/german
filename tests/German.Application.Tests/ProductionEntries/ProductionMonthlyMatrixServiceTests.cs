using German.Application.ProductionEntries;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionMonthlyMatrixServiceTests
{
    [TestMethod]
    public void MonthlyMatrixService_IsAvailableInApplicationLayer()
    {
        var serviceType = typeof(ProductionEntryQueryService).Assembly
            .GetType("German.Application.ProductionEntries.ProductionMonthlyMatrixService");

        Assert.IsNotNull(serviceType, "Monthly matrix application service has not been implemented yet.");
    }
}
