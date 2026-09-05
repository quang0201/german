using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace German.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BackfillProductionExternalSourcesData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "ProductionExternalSources" ("Id", "Name", "NormalizedName", "CreatedAt")
                SELECT (md5('production-external-source:' || UPPER(BTRIM(external."SourceName")))::uuid),
                       MIN(BTRIM(external."SourceName")),
                       UPPER(BTRIM(external."SourceName")),
                       NOW()
                FROM "ProductionExternalQuantities" AS external
                WHERE external."SourceName" IS NOT NULL
                  AND BTRIM(external."SourceName") <> ''
                GROUP BY UPPER(BTRIM(external."SourceName"))
                ON CONFLICT ("NormalizedName") DO NOTHING;

                UPDATE "ProductionExternalQuantities" AS external
                SET "ExternalSourceId" = source."Id"
                FROM "ProductionExternalSources" AS source
                WHERE external."SourceName" IS NOT NULL
                  AND UPPER(BTRIM(external."SourceName")) = source."NormalizedName";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "ProductionExternalQuantities"
                SET "ExternalSourceId" = NULL;
                """);
        }
    }
}
