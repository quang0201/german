using German.Application.Abstractions;
using German.Application.Common;
using German.Application.ProductionOrders;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Products;

public sealed class ProductService(IGermanDbContext db)
{
    public async Task<IReadOnlyList<ProductDto>> ListAsync(CancellationToken cancellationToken)
    {
        var products = await db.Products.AsNoTracking().Include(x => x.Operations).OrderBy(x => x.Code).ToListAsync(cancellationToken);
        var orderCounts = await CountOrdersAsync(cancellationToken);
        return products.Select(x => ToDto(x, orderCounts.GetValueOrDefault(x.Id))).ToList();
    }

    public async Task<AppResult<ProductDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking().Include(x => x.Operations).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        var orderCount = await db.ProductionOrders.CountAsync(x => x.ProductId == id, cancellationToken);
        return AppResult<ProductDto>.Success(ToDto(product, orderCount));
    }

    public async Task<AppResult<ProductDto>> CreateAsync(SaveProductCommand command, CancellationToken cancellationToken)
    {
        var validation = Validate(command);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var code = command.Code.Trim();
        if (await CodeExistsAsync(code, null, cancellationToken))
        {
            return DuplicateCode();
        }

        var product = new Product { Code = code, Name = command.Name.Trim(), IsActive = command.IsActive };
        foreach (var input in command.Operations.OrderBy(x => x.SortOrder))
        {
            product.Operations.Add(NewTemplate(product.Id, input));
        }

        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductDto>.Success(ToDto(product, 0));
    }

    public async Task<AppResult<ProductDto>> UpdateAsync(Guid id, SaveProductCommand command, CancellationToken cancellationToken)
    {
        var product = await db.Products.Include(x => x.Operations).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        var validation = Validate(command);
        if (!validation.IsSuccess)
        {
            return AppResult<ProductDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var code = command.Code.Trim();
        if (await CodeExistsAsync(code, id, cancellationToken))
        {
            return DuplicateCode();
        }

        product.Code = code;
        product.Name = command.Name.Trim();
        product.IsActive = command.IsActive;
        product.UpdatedAt = DateTimeOffset.UtcNow;

        var submitted = command.Operations.ToDictionary(x => x.OperationNumber);
        foreach (var removed in product.Operations.Where(x => !submitted.ContainsKey(x.OperationNumber)).ToList())
        {
            product.Operations.Remove(removed);
            db.ProductOperationTemplates.Remove(removed);
        }

        foreach (var input in command.Operations.OrderBy(x => x.SortOrder))
        {
            var existing = product.Operations.FirstOrDefault(x => x.OperationNumber == input.OperationNumber);
            if (existing is null)
            {
                var added = NewTemplate(product.Id, input);
                product.Operations.Add(added);
                db.ProductOperationTemplates.Add(added);
                continue;
            }

            existing.Name = input.Name.Trim();
            existing.Unit = input.Unit.Trim();
            existing.FixedPrice = input.FixedPrice;
            existing.SortOrder = input.SortOrder;
            existing.IsActive = input.IsActive;
        }

        await db.SaveChangesAsync(cancellationToken);
        var orderCount = await db.ProductionOrders.CountAsync(x => x.ProductId == id, cancellationToken);
        return AppResult<ProductDto>.Success(ToDto(product, orderCount));
    }

    public async Task<AppResult> DisableAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null)
        {
            return AppResult.Failure("product.not_found", "Không tìm thấy sản phẩm.");
        }

        product.IsActive = false;
        product.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult.Success();
    }

    private async Task<Dictionary<Guid, int>> CountOrdersAsync(CancellationToken cancellationToken) =>
        await db.ProductionOrders.AsNoTracking()
            .Where(x => x.ProductId != null)
            .GroupBy(x => x.ProductId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

    private Task<bool> CodeExistsAsync(string code, Guid? exceptId, CancellationToken cancellationToken)
    {
        var normalized = code.ToUpperInvariant();
        return db.Products.AnyAsync(x => x.Id != exceptId && x.Code.ToUpper() == normalized, cancellationToken);
    }

    private static AppResult Validate(SaveProductCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Code) || string.IsNullOrWhiteSpace(command.Name))
        {
            return AppResult.Failure("product.invalid", "Mã và tên sản phẩm không được để trống.");
        }

        return ProductionOrderService.ValidateOperations(command.Operations);
    }

    private static ProductOperationTemplate NewTemplate(Guid productId, ProductionOperationInput input) => new()
    {
        ProductId = productId,
        OperationNumber = input.OperationNumber,
        Name = input.Name.Trim(),
        Unit = input.Unit.Trim(),
        FixedPrice = input.FixedPrice,
        SortOrder = input.SortOrder,
        IsActive = input.IsActive
    };

    private static AppResult<ProductDto> NotFound() => AppResult<ProductDto>.Failure("product.not_found", "Không tìm thấy sản phẩm.");

    private static AppResult<ProductDto> DuplicateCode() => AppResult<ProductDto>.Failure("product.duplicate_code", "Mã sản phẩm đã tồn tại.");

    private static ProductDto ToDto(Product product, int orderCount) =>
        new(product.Id, product.Code, product.Name, product.IsActive, product.Operations.Count, orderCount,
            product.Operations.OrderBy(x => x.SortOrder)
                .Select(x => new ProductOperationTemplateDto(x.Id, x.OperationNumber, x.Name, x.Unit, x.FixedPrice, x.SortOrder, x.IsActive))
                .ToList());
}
