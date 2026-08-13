using German.Application.ProductionEntries;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.ProductionEntries;

[TestClass]
public sealed class ProductionEntryBatchDirectTests
{
    [TestMethod]
    public void ProductionEntryService_ExposesAtomicBatchDirectCreation()
    {
        var method = typeof(ProductionEntryService).GetMethod("CreateBatchDirectAsync");
        Assert.IsNotNull(method, "Atomic batch Direct creation is not implemented yet.");
    }
}
