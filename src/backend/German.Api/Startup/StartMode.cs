namespace German.Api.Startup;

public enum StartMode
{
    App,
    Migrations,
    Seed
}

public static class StartModeParser
{
    public static StartMode Parse(string[] args)
    {
        if (args.Length == 0 || IsHostOption(args[0]))
        {
            return StartMode.App;
        }

        return args[0].ToLowerInvariant() switch
        {
            "app" => StartMode.App,
            "migrations" => StartMode.Migrations,
            "seed" => StartMode.Seed,
            _ => throw new InvalidOperationException(
                $"Unknown start mode '{args[0]}'. Expected one of: app, migrations, seed.")
        };
    }

    public static string[] GetHostArguments(string[] args)
    {
        if (args.Length == 0 || IsHostOption(args[0]))
        {
            return args;
        }

        _ = Parse(args);
        return args[1..];
    }

    private static bool IsHostOption(string value) => value.StartsWith('-', StringComparison.Ordinal);
}
