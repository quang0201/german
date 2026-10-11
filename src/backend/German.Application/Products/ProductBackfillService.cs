using German.Application.Abstractions;
using German.Application.ProductionOrders;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Products;

public sealed record PlannedOrder(Guid OrderId, string Code);
public sealed record PlannedProduct(string Code, string Name, IReadOnlyList<ProductionOperationInput> Operations, IReadOnlyList<PlannedOrder> Orders);
public sealed record SkippedOrder(Guid OrderId, string Code, string Reason);
public sealed record PriceDifference(string ProductCode, int OperationNumber, IReadOnlyList<(string OrderCode, decimal? Price)> Prices);
public sealed record BackfillPlan(
    IReadOnlyList<PlannedProduct> Products,
    IReadOnlyList<SkippedOrder> Skipped,
    IReadOnlyList<PriceDifference> PriceDifferences);

/// <summary>
/// Groups legacy production orders into products: same base number and same operation signature
/// (number, name, unit; price is not part of it). Planning never writes; applying is idempotent.
/// </summary>
public sealed class ProductBackfillService(IGermanDbContext db)
{
    public async Task<BackfillPlan> PlanAsync(CancellationToken cancellationToken)
    {
        var orders = await db.ProductionOrders.AsNoTracking().Where(x => x.ProductId == null).ToListAsync(cancellationToken);
        var orderIds = orders.Select(x => x.Id).ToArray();
        var operations = (await db.ProductionOperations.AsNoTracking().Where(x => orderIds.Contains(x.ProductionOrderId)).ToListAsync(cancellationToken))
            .ToLookup(x => x.ProductionOrderId);
        var existing = await db.Products.AsNoTracking().Include(x => x.Operations).ToListAsync(cancellationToken);
        var existingByCode = existing.ToDictionary(x => x.Code.ToUpperInvariant());

        var products = new List<PlannedProduct>();
        var skipped = new List<SkippedOrder>();
        var differences = new List<PriceDifference>();

        foreach (var byBase in orders.GroupBy(x => ProductCodeKey.BaseOf(x.Code)).OrderBy(g => g.Key, StringComparer.Ordinal))
        {
            var withOperations = new List<(ProductionOrder Order, List<ProductionOperation> Operations, string Signature)>();
            foreach (var order in byBase.OrderBy(x => x.Code, StringComparer.OrdinalIgnoreCase))
            {
                var orderOperations = operations[order.Id].OrderBy(x => x.SortOrder).ToList();
                if (orderOperations.Count == 0)
                {
                    skipped.Add(new SkippedOrder(order.Id, order.Code, "Mã chưa có công đoạn nào."));
                    continue;
                }

                withOperations.Add((order, orderOperations, Signature(orderOperations.Select(x => (x.OperationNumber, x.Name, x.Unit)))));
            }

            var groups = withOperations.GroupBy(x => x.Signature).ToList();
            existingByCode.TryGetValue(byBase.Key, out var existingProduct);
            var existingSignature = existingProduct is null
                ? null
                : Signature(existingProduct.Operations.Where(x => x.IsActive).Select(x => (x.OperationNumber, x.Name, x.Unit)));

            // The winning group: the one matching an already created product, otherwise the largest (ties: first order code).
            var winner = existingSignature is not null
                ? groups.FirstOrDefault(g => g.Key == existingSignature)
                : groups.OrderByDescending(g => g.Count()).ThenBy(g => g.First().Order.Code, StringComparer.OrdinalIgnoreCase).FirstOrDefault();
            var canGroup = winner is not null && (existingProduct is not null || winner.Count() >= 2);

            foreach (var group in groups)
            {
                if (canGroup && ReferenceEquals(group, winner))
                {
                    continue;
                }

                foreach (var item in group)
                {
                    var reason = groups.Count > 1 && canGroup
                        ? $"Danh sách CĐ khác với nhóm {byBase.Key}."
                        : existingProduct is not null
                            ? $"Danh sách CĐ khác với sản phẩm {existingProduct.Code} đã có."
                            : "Chỉ có một mã với số gốc và danh sách CĐ này.";
                    skipped.Add(new SkippedOrder(item.Order.Id, item.Order.Code, reason));
                }
            }

            if (!canGroup)
            {
                continue;
            }

            var members = winner!.ToList();
            var first = members[0];
            var name = existingProduct?.Name
                ?? members.Select(x => x.Order.ProductName.Trim()).OrderBy(x => x.Length).ThenBy(x => x, StringComparer.OrdinalIgnoreCase).First();
            var templates = first.Operations
                .Select(x => new ProductionOperationInput(x.OperationNumber, x.Name, x.Unit, x.SortOrder, x.IsActive, x.FixedPrice))
                .ToList();
            products.Add(new PlannedProduct(existingProduct?.Code ?? byBase.Key, name, templates, members.Select(x => new PlannedOrder(x.Order.Id, x.Order.Code)).ToList()));

            foreach (var number in members.SelectMany(x => x.Operations).Select(x => x.OperationNumber).Distinct().Order())
            {
                var prices = members
                    .Select(x => (x.Order.Code, Price: x.Operations.FirstOrDefault(o => o.OperationNumber == number)?.FixedPrice))
                    .ToList();
                if (prices.Select(x => x.Price).Distinct().Count() > 1)
                {
                    differences.Add(new PriceDifference(byBase.Key, number, prices.Select(x => (x.Code, x.Price)).ToList()));
                }
            }
        }

        return new BackfillPlan(products, skipped.OrderBy(x => x.Code, StringComparer.OrdinalIgnoreCase).ToList(), differences);
    }

    /// <summary>Writes the plan and returns how many orders were newly linked. Safe to run again.</summary>
    public async Task<int> ApplyAsync(BackfillPlan plan, CancellationToken cancellationToken)
    {
        var linked = 0;
        foreach (var planned in plan.Products)
        {
            var normalized = planned.Code.ToUpperInvariant();
            var product = await db.Products.FirstOrDefaultAsync(x => x.Code.ToUpper() == normalized, cancellationToken);
            if (product is null)
            {
                product = new Product { Code = planned.Code, Name = planned.Name };
                foreach (var input in planned.Operations)
                {
                    product.Operations.Add(new ProductOperationTemplate
                    {
                        ProductId = product.Id,
                        OperationNumber = input.OperationNumber,
                        Name = input.Name,
                        Unit = input.Unit,
                        FixedPrice = input.FixedPrice,
                        SortOrder = input.SortOrder,
                        IsActive = input.IsActive
                    });
                }

                db.Products.Add(product);
            }

            var ids = planned.Orders.Select(x => x.OrderId).ToArray();
            var orders = await db.ProductionOrders.Where(x => ids.Contains(x.Id) && x.ProductId == null).ToListAsync(cancellationToken);
            foreach (var order in orders)
            {
                order.ProductId = product.Id;
                linked++;
            }

            await db.SaveChangesAsync(cancellationToken);
        }

        return linked;
    }

    private static string Signature(IEnumerable<(int Number, string Name, string Unit)> operations) =>
        string.Join("|", operations
            .OrderBy(x => x.Number)
            .Select(x => $"{x.Number}:{x.Name.Trim().ToUpperInvariant()}:{x.Unit.Trim().ToUpperInvariant()}"));
}
