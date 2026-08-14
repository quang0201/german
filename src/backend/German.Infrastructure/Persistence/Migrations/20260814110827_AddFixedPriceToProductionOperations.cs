using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace German.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFixedPriceToProductionOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "FixedPrice",
                table: "ProductionOperations",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FixedPrice",
                table: "ProductionOperations");
        }
    }
}
