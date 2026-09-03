using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Infrastructure.Tests;

[TestClass]
public sealed class ProductionExternalQuantityModelTests
{
    [TestMethod]
    public void ExternalQuantityHasExpectedPrecisionLengthsAndIndex()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseNpgsql("Host=localhost;Database=metadata-only;Username=test;Password=test")
            .Options;
        using var db = new GermanDbContext(options);
        var entity = db.Model.FindEntityType(typeof(ProductionExternalQuantity))!;

        Assert.AreEqual("numeric(18,2)", entity.FindProperty(nameof(ProductionExternalQuantity.Quantity))!.GetColumnType());
        Assert.AreEqual(200, entity.FindProperty(nameof(ProductionExternalQuantity.SourceName))!.GetMaxLength());
        Assert.AreEqual(1000, entity.FindProperty(nameof(ProductionExternalQuantity.Note))!.GetMaxLength());
        Assert.IsTrue(entity.GetIndexes().Any(index => index.Properties.Select(property => property.Name).SequenceEqual(new[] { "ProductionOrderId", "ProductionOperationId", "ReceivedDate" })));
    }
}
