using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;

namespace German.Api.Startup;

public static class DataProtectionConfiguration
{
    public const string DefaultKeyDirectory = "/app-keys";
    public const string ApplicationName = "German";

    public static IServiceCollection AddGermanDataProtection(
        this IServiceCollection services,
        string keyDirectory = DefaultKeyDirectory)
    {
        return services
            .AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory))
            .SetApplicationName(ApplicationName)
            .Services;
    }
}
