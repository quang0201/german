using German.Api.Startup;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class DataProtectionConfigurationTests
{
    [TestMethod]
    public void AddGermanDataProtection_AllowsARecreatedAppToReadExistingKeys()
    {
        var keyDirectory = Path.Combine(Path.GetTempPath(), $"german-data-protection-{Guid.NewGuid():N}");
        try
        {
            var firstServices = new ServiceCollection();
            firstServices.AddGermanDataProtection(keyDirectory);
            using var firstProvider = firstServices.BuildServiceProvider();
            var protectedValue = firstProvider
                .GetRequiredService<IDataProtectionProvider>()
                .CreateProtector("German.Api.Tests")
                .Protect("session-cookie");

            var recreatedServices = new ServiceCollection();
            recreatedServices.AddGermanDataProtection(keyDirectory);
            using var recreatedProvider = recreatedServices.BuildServiceProvider();
            var unprotectedValue = recreatedProvider
                .GetRequiredService<IDataProtectionProvider>()
                .CreateProtector("German.Api.Tests")
                .Unprotect(protectedValue);

            Assert.AreEqual("session-cookie", unprotectedValue);
        }
        finally
        {
            if (Directory.Exists(keyDirectory)) Directory.Delete(keyDirectory, recursive: true);
        }
    }
}
