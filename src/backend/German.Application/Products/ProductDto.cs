using German.Application.ProductionOrders;

namespace German.Application.Products;

public sealed record SaveProductCommand(string Code, string Name, bool IsActive, IReadOnlyList<ProductionOperationInput> Operations);
public sealed record ProductOperationTemplateDto(Guid Id, int OperationNumber, string Name, string Unit, decimal? FixedPrice, int SortOrder, bool IsActive);
public sealed record ProductDto(
    Guid Id,
    string Code,
    string Name,
    bool IsActive,
    int OperationCount,
    int OrderCount,
    IReadOnlyList<ProductOperationTemplateDto> Operations);
