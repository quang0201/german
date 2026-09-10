using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auth;
using German.Domain.Production;
using Microsoft.EntityFrameworkCore;

namespace German.Application.ProductionOrders;

public sealed record ProductionExternalSourceDto(
    Guid Id,
    string Name,
    bool IsActive,
    DateTimeOffset CreatedAt);

public sealed record CreateProductionExternalSourceCommand(string Name);

public sealed record UpdateProductionExternalSourceCommand(string Name, bool IsActive);

public sealed class ProductionExternalSourceService(IGermanDbContext db)
{
    public async Task<IReadOnlyList<ProductionExternalSourceDto>> ListAsync(bool includeInactive, CancellationToken cancellationToken)
    {
        var query = db.ProductionExternalSources.AsNoTracking();
        if (!includeInactive)
        {
            query = query.Where(source => source.IsActive);
        }

        var sources = await query.OrderBy(source => source.Name).ToListAsync(cancellationToken);
        return sources.Select(ToDto).ToArray();
    }

    public async Task<AppResult<ProductionExternalSourceDto>> CreateAsync(CurrentActor actor, CreateProductionExternalSourceCommand command, CancellationToken cancellationToken)
    {
        var authorization = EnsureManagerOrAdmin(actor);
        if (!authorization.IsSuccess) return AppResult<ProductionExternalSourceDto>.Failure(authorization.Error!.Code, authorization.Error.Message);

        var validation = ValidateName(command.Name);
        if (!validation.IsSuccess) return AppResult<ProductionExternalSourceDto>.Failure(validation.Error!.Code, validation.Error.Message);

        var normalizedName = NormalizeKey(command.Name)!;
        if (await db.ProductionExternalSources.AnyAsync(source => source.NormalizedName == normalizedName, cancellationToken))
        {
            return AppResult<ProductionExternalSourceDto>.Failure("production_external_source.duplicate", "Nguồn gia công ngoài đã tồn tại.");
        }

        var source = new ProductionExternalSource { Name = command.Name.Trim(), NormalizedName = normalizedName };
        db.ProductionExternalSources.Add(source);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionExternalSourceDto>.Success(ToDto(source));
    }

    public async Task<AppResult<ProductionExternalSourceDto>> UpdateAsync(CurrentActor actor, Guid id, UpdateProductionExternalSourceCommand command, CancellationToken cancellationToken)
    {
        var authorization = EnsureManagerOrAdmin(actor);
        if (!authorization.IsSuccess) return AppResult<ProductionExternalSourceDto>.Failure(authorization.Error!.Code, authorization.Error.Message);

        var validation = ValidateName(command.Name);
        if (!validation.IsSuccess) return AppResult<ProductionExternalSourceDto>.Failure(validation.Error!.Code, validation.Error.Message);

        var source = await db.ProductionExternalSources.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (source is null) return AppResult<ProductionExternalSourceDto>.Failure("production_external_source.not_found", "Không tìm thấy nguồn gia công ngoài.");

        var normalizedName = NormalizeKey(command.Name)!;
        if (await db.ProductionExternalSources.AnyAsync(item => item.Id != id && item.NormalizedName == normalizedName, cancellationToken))
        {
            return AppResult<ProductionExternalSourceDto>.Failure("production_external_source.duplicate", "Nguồn gia công ngoài đã tồn tại.");
        }

        source.Name = command.Name.Trim();
        source.NormalizedName = normalizedName;
        source.IsActive = command.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ProductionExternalSourceDto>.Success(ToDto(source));
    }

    private static AppResult ValidateName(string? name) => string.IsNullOrWhiteSpace(name)
        ? AppResult.Failure("production_external_source.invalid_name", "Tên nguồn gia công ngoài không được để trống.")
        : name.Trim().Length > 200
            ? AppResult.Failure("production_external_source.invalid_name", "Tên nguồn gia công ngoài không được dài quá 200 ký tự.")
            : AppResult.Success();

    private static AppResult EnsureManagerOrAdmin(CurrentActor actor) => actor.Role is UserRole.Manager or UserRole.Admin
        ? AppResult.Success()
        : AppResult.Failure("production_external_source.forbidden", "Bạn không có quyền quản lý nguồn gia công ngoài.");

    private static string? NormalizeKey(string? name)
    {
        var value = name?.Trim();
        return string.IsNullOrWhiteSpace(value) ? null : value.ToUpperInvariant();
    }

    private static ProductionExternalSourceDto ToDto(ProductionExternalSource source) => new(source.Id, source.Name, source.IsActive, source.CreatedAt);
}
