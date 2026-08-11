using German.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddGermanInfrastructure(builder.Configuration);

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

public partial class Program;
