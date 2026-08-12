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
        if (args.Length == 0)
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
}
