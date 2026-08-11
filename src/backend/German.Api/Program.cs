using System.Text.Json.Serialization;
using German.Api.Endpoints;
using German.Application.Auth;
using German.Application.Employees;
using German.Application.ProductionEntries;
using German.Application.ProductionOrders;
using German.Application.Shifts;
using German.Domain.Auth;
using German.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddGermanInfrastructure(builder.Configuration);
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ProductionEntryService>();
builder.Services.AddScoped<EmployeeService>();
builder.Services.AddScoped<ShiftTemplateService>();
builder.Services.AddScoped<ProductionOrderService>();

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

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAuthEndpoints();
app.MapProductionEntryEndpoints();
app.MapLookupEndpoints();
app.MapEmployeeEndpoints();
app.MapShiftTemplateEndpoints();
app.MapProductionOrderAdminEndpoints();

app.Run();

public partial class Program;
