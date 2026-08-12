using System.Text.Json.Serialization;
using German.Api.Endpoints;
using German.Application.Auth;
using German.Application.Employees;
using German.Application.Lookups;
using German.Application.ProductionEntries;
using German.Application.ProductionOrders;
using German.Application.Shifts;
using German.Domain.Auth;
using German.Infrastructure;
using German.Infrastructure.Bootstrap;
using German.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddGermanInfrastructure(builder.Configuration);
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserAccountService>();
builder.Services.AddScoped<ProductionEntryService>();
builder.Services.AddScoped<ProductionEntryQueryService>();
builder.Services.AddScoped<EmployeeService>();
builder.Services.AddScoped<ShiftTemplateService>();
builder.Services.AddScoped<ProductionOrderService>();
builder.Services.AddScoped<LookupService>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "german.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ManagerOrAdmin", policy =>
        policy.RequireRole(UserRole.Manager.ToString(), UserRole.Admin.ToString()))
    .AddPolicy("AdminOnly", policy => policy.RequireRole(UserRole.Admin.ToString()));

var app = builder.Build();

if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<GermanDbContext>();
    await db.Database.MigrateAsync();

    var bootstrapOptions = builder.Configuration
        .GetSection("BootstrapAdmin")
        .Get<BootstrapAdminOptions>() ?? new BootstrapAdminOptions();
    var bootstrapSeeder = scope.ServiceProvider.GetRequiredService<BootstrapAdminSeeder>();
    await bootstrapSeeder.SeedAsync(bootstrapOptions, CancellationToken.None);
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAuthEndpoints();
app.MapUserAccountAdminEndpoints();
app.MapProductionEntryEndpoints();
app.MapLookupEndpoints();
app.MapEmployeeEndpoints();
app.MapShiftTemplateEndpoints();
app.MapProductionOrderAdminEndpoints();
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
