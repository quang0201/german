using German.Application.Abstractions;
using German.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace German.Api.Tests;

public sealed class GermanApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"german-api-tests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<GermanDbContext>>();
            services.RemoveAll<GermanDbContext>();
            services.RemoveAll<IGermanDbContext>();

            services.AddDbContext<GermanDbContext>(options => options.UseInMemoryDatabase(_databaseName));
            services.AddScoped<IGermanDbContext>(sp => sp.GetRequiredService<GermanDbContext>());
        });
    }

    public async Task SeedAsync(Func<IServiceProvider, Task> seed)
    {
        using var scope = Services.CreateScope();
        await seed(scope.ServiceProvider);
    }
}
