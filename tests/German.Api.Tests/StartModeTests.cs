using German.Api.Startup;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class StartModeTests
{
    [TestMethod]
    public void Parse_NoArguments_DefaultsToApp()
    {
        Assert.AreEqual(StartMode.App, StartModeParser.Parse([]));
    }

    [DataTestMethod]
    [DataRow("app", StartMode.App)]
    [DataRow("APP", StartMode.App)]
    [DataRow("migrations", StartMode.Migrations)]
    [DataRow("MIGRATIONS", StartMode.Migrations)]
    [DataRow("seed", StartMode.Seed)]
    [DataRow("SEED", StartMode.Seed)]
    public void Parse_KnownMode_ReturnsExpectedMode(string value, StartMode expected)
    {
        Assert.AreEqual(expected, StartModeParser.Parse([value]));
    }

    [TestMethod]
    public void Parse_UnknownMode_Throws()
    {
        var exception = Assert.ThrowsExactly<InvalidOperationException>(
            () => StartModeParser.Parse(["unknown"]));

        StringAssert.Contains(exception.Message, "unknown");
    }
}
