using German.Api.Contracts.ProductionOrders;

namespace German.Api.Contracts.Products;

public sealed record SaveProductRequest(string Code, string Name, bool IsActive = true, IReadOnlyList<ProductionOperationRequest>? Operations = null);
