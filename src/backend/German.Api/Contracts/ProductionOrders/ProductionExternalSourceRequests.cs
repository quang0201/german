namespace German.Api.Contracts.ProductionOrders;

public sealed record CreateProductionExternalSourceRequest(string Name);

public sealed record UpdateProductionExternalSourceRequest(string Name, bool IsActive);
