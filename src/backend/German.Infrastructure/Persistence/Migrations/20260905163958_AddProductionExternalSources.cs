using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace German.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionExternalSources : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ExternalSourceId",
                table: "ProductionExternalQuantities",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProductionExternalSources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionExternalSources", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionExternalQuantities_ExternalSourceId",
                table: "ProductionExternalQuantities",
                column: "ExternalSourceId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionExternalSources_NormalizedName",
                table: "ProductionExternalSources",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionExternalQuantities_ProductionExternalSources_Exte~",
                table: "ProductionExternalQuantities",
                column: "ExternalSourceId",
                principalTable: "ProductionExternalSources",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionExternalQuantities_ProductionExternalSources_Exte~",
                table: "ProductionExternalQuantities");

            migrationBuilder.DropTable(
                name: "ProductionExternalSources");

            migrationBuilder.DropIndex(
                name: "IX_ProductionExternalQuantities_ExternalSourceId",
                table: "ProductionExternalQuantities");

            migrationBuilder.DropColumn(
                name: "ExternalSourceId",
                table: "ProductionExternalQuantities");
        }
    }
}
