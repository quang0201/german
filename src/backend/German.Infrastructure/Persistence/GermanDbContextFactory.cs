using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace German.Infrastructure.Persistence;

public sealed class GermanDbContextFactory : IDesignTimeDbContextFactory<GermanDbContext>
{
    public GermanDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__German")
            ?? "Host=localhost;Port=5432;Database=german;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<GermanDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new GermanDbContext(options);
    }
}
