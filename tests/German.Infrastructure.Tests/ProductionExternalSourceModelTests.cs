using German.Domain.Production;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Infrastructure.Tests;

[TestClass]
public sealed class ProductionExternalSourceModelTests
{
    [TestMethod]
    public void ExternalSourceHasActiveFlagAndUniqueNormalizedName()
    {
        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseNpgsql("Host=localhost;Database=metadata-only;Username=test;Password=test")
            .Options;
        using var db = new GermanDbContext(options);
        var entity = db.Model.FindEntityType(typeof(ProductionExternalSource))!;

        Assert.IsTrue(new ProductionExternalSource().IsActive);
        Assert.AreEqual(typeof(bool), entity.FindProperty(nameof(ProductionExternalSource.IsActive))!.ClrType);
        Assert.IsTrue(entity.GetIndexes().Any(index => index.IsUnique && index.Properties.Select(property => property.Name).SequenceEqual(new[] { nameof(ProductionExternalSource.NormalizedName) })));
    }
}
