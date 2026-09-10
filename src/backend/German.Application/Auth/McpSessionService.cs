using System.Security.Cryptography;
using System.Text;
using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Auditing;
using German.Domain.Auth;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Auth;

public sealed record McpSessionCodeDto(string Code, DateTimeOffset ExpiresAt);

public sealed class McpSessionService(IGermanDbContext db, TimeProvider timeProvider)
{
    public async Task<AppResult<McpSessionCodeDto>> CreateAsync(Guid issuedByUserId, CancellationToken cancellationToken)
    {
        var account = await db.UserAccounts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == issuedByUserId, cancellationToken);
        if (account is null || !account.IsActive || (account.Role != UserRole.Manager && account.Role != UserRole.Admin))
        {
            return AppResult<McpSessionCodeDto>.Failure("auth.mcp_forbidden", "Tài khoản không được tạo mã MCP.");
        }

        var code = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        var now = timeProvider.GetUtcNow();
        var grant = new McpSessionCode
        {
            CodeHash = Hash(code),
            IssuedByUserId = issuedByUserId,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(10)
        };
        db.McpSessionCodes.Add(grant);
        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(McpSessionCode),
            EntityId = grant.Id,
            Action = AuditAction.Create,
            PerformedByUserId = issuedByUserId,
            PerformedAt = now,
            AfterJson = System.Text.Json.JsonSerializer.Serialize(new { grant.ExpiresAt })
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<McpSessionCodeDto>.Success(new McpSessionCodeDto(code, grant.ExpiresAt));
    }

    public async Task<AppResult<AuthSessionDto>> ExchangeAsync(string? code, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code)) return InvalidCode();

        var now = timeProvider.GetUtcNow();
        var grant = await db.McpSessionCodes.SingleOrDefaultAsync(x => x.CodeHash == Hash(code.Trim()), cancellationToken);
        if (grant is null || grant.UsedAt.HasValue || grant.ExpiresAt <= now) return InvalidCode();

        var account = await db.UserAccounts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == grant.IssuedByUserId, cancellationToken);
        if (account is null || !account.IsActive || (account.Role != UserRole.Manager && account.Role != UserRole.Admin)) return InvalidCode();

        string? employeeCode = null;
        string? fullName = null;
        if (account.EmployeeId.HasValue)
        {
            var employee = await db.Employees.AsNoTracking().SingleOrDefaultAsync(x => x.Id == account.EmployeeId.Value, cancellationToken);
            if (employee is null || !employee.IsActive) return InvalidCode();
            employeeCode = employee.EmployeeCode;
            fullName = employee.FullName;
        }

        var previousUsedAt = grant.UsedAt;
        grant.UsedAt = now;
        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(McpSessionCode),
            EntityId = grant.Id,
            Action = AuditAction.Update,
            PerformedByUserId = account.Id,
            PerformedAt = now,
            BeforeJson = System.Text.Json.JsonSerializer.Serialize(new { usedAt = previousUsedAt }),
            AfterJson = System.Text.Json.JsonSerializer.Serialize(new { usedAt = now })
        });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return InvalidCode();
        }

        return AppResult<AuthSessionDto>.Success(new AuthSessionDto(
            account.Id,
            account.Username,
            account.Role,
            account.EmployeeId,
            employeeCode,
            fullName));
    }

    private static string Hash(string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

    private static AppResult<AuthSessionDto> InvalidCode() =>
        AppResult<AuthSessionDto>.Failure("auth.invalid_mcp_code", "Mã MCP không hợp lệ, đã dùng hoặc đã hết hạn.");
}
