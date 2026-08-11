using German.Application.Abstractions;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace German.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddGermanInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("German")
            ?? throw new InvalidOperationException("Connection string 'German' is not configured.");

        services.AddDbContext<GermanDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IGermanDbContext>(sp => sp.GetRequiredService<GermanDbContext>());
        return services;
    }
}
