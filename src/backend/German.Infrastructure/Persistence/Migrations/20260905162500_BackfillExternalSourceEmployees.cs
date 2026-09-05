using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace German.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class BackfillExternalSourceEmployees : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE "ProductionExternalQuantities" AS external
            SET "SourceEmployeeId" = employee."Id"
            FROM "Employees" AS employee
            WHERE external."SourceEmployeeId" IS NULL
              AND external."SourceName" IS NOT NULL
              AND LOWER(BTRIM(external."SourceName")) = LOWER(BTRIM(employee."FullName"))
              AND (
                  SELECT COUNT(*)
                  FROM "Employees" AS candidate
                  WHERE LOWER(BTRIM(candidate."FullName")) = LOWER(BTRIM(external."SourceName"))
              ) = 1;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE "ProductionExternalQuantities" AS external
            SET "SourceEmployeeId" = NULL
            FROM "Employees" AS employee
            WHERE external."SourceEmployeeId" = employee."Id"
              AND external."SourceName" IS NOT NULL
              AND LOWER(BTRIM(external."SourceName")) = LOWER(BTRIM(employee."FullName"));
            """);
    }
}
