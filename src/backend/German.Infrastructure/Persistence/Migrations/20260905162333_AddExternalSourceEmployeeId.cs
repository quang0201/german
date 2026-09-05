using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace German.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalSourceEmployeeId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceEmployeeId",
                table: "ProductionExternalQuantities",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductionExternalQuantities_SourceEmployeeId",
                table: "ProductionExternalQuantities",
                column: "SourceEmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionExternalQuantities_Employees_SourceEmployeeId",
                table: "ProductionExternalQuantities",
                column: "SourceEmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionExternalQuantities_Employees_SourceEmployeeId",
                table: "ProductionExternalQuantities");

            migrationBuilder.DropIndex(
                name: "IX_ProductionExternalQuantities_SourceEmployeeId",
                table: "ProductionExternalQuantities");

            migrationBuilder.DropColumn(
                name: "SourceEmployeeId",
                table: "ProductionExternalQuantities");
        }
    }
}
