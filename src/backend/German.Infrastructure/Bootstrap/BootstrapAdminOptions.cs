namespace German.Infrastructure.Bootstrap;

public sealed class BootstrapAdminOptions
{
    public bool Enabled { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
