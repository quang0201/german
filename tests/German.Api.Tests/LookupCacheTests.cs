using German.Api.Caching;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class LookupCacheTests
{
    [TestMethod]
    public async Task SharesAnInFlightLookupForTheSameKey()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cache = new LookupCache(memoryCache);
        var calls = 0;

        var results = await Task.WhenAll(
            cache.GetOrCreateAsync("lookup", TimeSpan.FromMinutes(1), async () =>
            {
                Interlocked.Increment(ref calls);
                await Task.Yield();
                return 42;
            }),
            cache.GetOrCreateAsync("lookup", TimeSpan.FromMinutes(1), async () =>
            {
                Interlocked.Increment(ref calls);
                await Task.Yield();
                return 42;
            }));

        CollectionAssert.AreEqual(new[] { 42, 42 }, results);
        Assert.AreEqual(1, calls);
    }

    [TestMethod]
    public async Task InvalidationForcesTheNextLookupToReload()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cache = new LookupCache(memoryCache);
        var calls = 0;

        await cache.GetOrCreateAsync("lookup", TimeSpan.FromMinutes(1), () => Task.FromResult(++calls));
        cache.Invalidate("lookup");
        var result = await cache.GetOrCreateAsync("lookup", TimeSpan.FromMinutes(1), () => Task.FromResult(++calls));

        Assert.AreEqual(2, result);
    }
}
