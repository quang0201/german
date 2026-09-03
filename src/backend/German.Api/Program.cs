using System.Security.Claims;
using System.Text.Json.Serialization;
using German.Api.Endpoints;
using German.Api.Startup;
using German.Application.Auth;
using German.Application.Attendance;
using German.Application.Auditing;
using German.Application.Employees;
using German.Application.Lookups;
using German.Application.ProductionEntries;
using German.Application.ProductionOrders;
using German.Application.Reports;
using German.Application.Shifts;
using German.Domain.Auth;
using German.Infrastructure;
using German.Infrastructure.Bootstrap;
using German.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

var startMode = StartModeParser.Parse(args);
var builder = WebApplication.CreateBuilder(StartModeParser.GetHostArguments(args));

builder.Services.AddGermanInfrastructure(builder.Configuration);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AttendanceService>();
builder.Services.AddScoped<AttendanceExportService>();
builder.Services.AddScoped<AttendanceHoursQueryService>();
builder.Services.AddScoped<UserAccountService>();
builder.Services.AddScoped<ProductionEntryService>();
builder.Services.AddScoped<ProductionEntryBatchDirectService>();
builder.Services.AddScoped<ProductionEntryQueryService>();
builder.Services.AddScoped<ProductionMonthlyMatrixService>();
builder.Services.AddScoped<EmployeeService>();
builder.Services.AddScoped<ShiftTemplateService>();
builder.Services.AddScoped<ProductionOrderService>();
builder.Services.AddScoped<LookupService>();
builder.Services.AddScoped<ProductionReportService>();
builder.Services.AddScoped<ProductionExternalQuantityService>();
builder.Services.AddScoped<AuditLogQueryService>();

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
        options.Events.OnValidatePrincipal = async context =>
        {
            var principal = context.Principal;
            var userIdText = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var roleText = principal?.FindFirstValue(ClaimTypes.Role);
            var employeeIdText = principal?.FindFirstValue("employee_id");
            if (!Guid.TryParse(userIdText, out var userId)
                || !Enum.TryParse<UserRole>(roleText, out var role)
                || (employeeIdText is not null && !Guid.TryParse(employeeIdText, out _)))
            {
                context.RejectPrincipal();
                return;
            }

            var db = context.HttpContext.RequestServices.GetRequiredService<GermanDbContext>();
            var account = await db.UserAccounts.AsNoTracking()
                .Where(x => x.Id == userId)
                .Select(x => new { x.IsActive, x.Role, x.EmployeeId })
                .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
            var claimedEmployeeId = Guid.TryParse(employeeIdText, out var parsedEmployeeId)
                ? parsedEmployeeId
                : (Guid?)null;
            var employeeIsActive = !claimedEmployeeId.HasValue || await db.Employees.AsNoTracking()
                .AnyAsync(x => x.Id == claimedEmployeeId.Value && x.IsActive, context.HttpContext.RequestAborted);

            if (account is null
                || !account.IsActive
                || account.Role != role
                || account.EmployeeId != claimedEmployeeId
                || !employeeIsActive)
            {
                context.RejectPrincipal();
            }
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ManagerOrAdmin", policy =>
        policy.RequireRole(UserRole.Manager.ToString(), UserRole.Admin.ToString()))
    .AddPolicy("AdminOnly", policy => policy.RequireRole(UserRole.Admin.ToString()));

var app = builder.Build();

switch (startMode)
{
    case StartMode.Migrations:
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GermanDbContext>();
        await db.Database.MigrateAsync();
        return;
    }
    case StartMode.Seed:
    {
        using var scope = app.Services.CreateScope();
        var bootstrapOptions = builder.Configuration
            .GetSection("BootstrapAdmin")
            .Get<BootstrapAdminOptions>() ?? new BootstrapAdminOptions();
        var bootstrapSeeder = scope.ServiceProvider.GetRequiredService<BootstrapAdminSeeder>();
        await bootstrapSeeder.SeedAsync(bootstrapOptions, CancellationToken.None);
        return;
    }
    case StartMode.App:
        break;
    default:
        throw new InvalidOperationException($"Unsupported start mode: {startMode}.");
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAuthEndpoints();
app.MapAttendanceEndpoints();
app.MapUserAccountAdminEndpoints();
app.MapProductionEntryEndpoints();
app.MapLookupEndpoints();
app.MapEmployeeEndpoints();
app.MapShiftTemplateEndpoints();
app.MapProductionOrderAdminEndpoints();
app.MapReportEndpoints();
app.MapProductionExternalQuantityEndpoints();
app.MapAuditLogEndpoints();
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
