using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace German.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMcpSessionCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "McpSessionCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    IssuedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_McpSessionCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_McpSessionCodes_UserAccounts_IssuedByUserId",
                        column: x => x.IssuedByUserId,
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_McpSessionCodes_CodeHash",
                table: "McpSessionCodes",
                column: "CodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_McpSessionCodes_IssuedByUserId",
                table: "McpSessionCodes",
                column: "IssuedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "McpSessionCodes");
        }
    }
}
