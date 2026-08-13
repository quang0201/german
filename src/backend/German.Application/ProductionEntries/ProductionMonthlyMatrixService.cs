using German.Application.Abstractions;
using German.Application.Common;

namespace German.Application.ProductionEntries;

public sealed class ProductionMonthlyMatrixService(IGermanDbContext db)
{
    public Task<AppResult<ProductionMonthlyMatrixResult>> GetAsync(
        ProductionMonthlyMatrixQuery query,
        CancellationToken cancellationToken)
    {
        _ = db;
        _ = query;
        _ = cancellationToken;
        return Task.FromResult(AppResult<ProductionMonthlyMatrixResult>.Failure(
            "production_matrix.not_implemented",
            "Monthly production matrix is not implemented yet."));
    }
}
