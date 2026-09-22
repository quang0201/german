using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace German.Api.Caching;

public sealed class LookupCache(IMemoryCache memoryCache)
{
    private readonly ConcurrentDictionary<string, Lazy<Task<object?>>> inFlight = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, byte> operationKeys = new(StringComparer.Ordinal);

    public static string ActiveProductionOperationsKey(Guid orderId) => $"lookup:production-operations:{orderId}";

    public async Task<T> GetOrCreateAsync<T>(string key, TimeSpan lifetime, Func<Task<T>> factory)
    {
        if (memoryCache.TryGetValue(key, out T? cached))
        {
            return cached!;
        }

        var pending = inFlight.GetOrAdd(
            key,
            _ => new Lazy<Task<object?>>(
                async () => await factory().ConfigureAwait(false),
                LazyThreadSafetyMode.ExecutionAndPublication));

        try
        {
            var value = (T)(await pending.Value.ConfigureAwait(false))!;
            if (inFlight.TryGetValue(key, out var current) && ReferenceEquals(current, pending))
            {
                memoryCache.Set(key, value, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = lifetime,
                    Size = 1
                });
            }
            return value;
        }
        catch
        {
            RemoveInFlight(key, pending);
            throw;
        }
        finally
        {
            RemoveInFlight(key, pending);
        }
    }

    public void TrackOperationKey(Guid orderId) => operationKeys.TryAdd(ActiveProductionOperationsKey(orderId), 0);

    public void Invalidate(string key)
    {
        memoryCache.Remove(key);
        inFlight.TryRemove(key, out _);
        operationKeys.TryRemove(key, out _);
    }

    public void InvalidateActiveProductionOrders() => Invalidate("lookup:active-production-orders");

    public void InvalidateOperations(Guid orderId) => Invalidate(ActiveProductionOperationsKey(orderId));

    public void InvalidateAll()
    {
        InvalidateActiveProductionOrders();
        foreach (var key in operationKeys.Keys)
        {
            Invalidate(key);
        }
    }

    private void RemoveInFlight(string key, Lazy<Task<object?>> pending)
    {
        ((ICollection<KeyValuePair<string, Lazy<Task<object?>>>>)inFlight)
            .Remove(new KeyValuePair<string, Lazy<Task<object?>>>(key, pending));
    }
}
