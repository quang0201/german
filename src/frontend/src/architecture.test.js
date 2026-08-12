import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../..");

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function projectReferences(relativePath) {
  const content = read(relativePath);
  return [...content.matchAll(/<ProjectReference\s+Include="([^"]+)"/g)]
    .map((match) => basename(match[1].replaceAll("\\", "/"), ".csproj"))
    .sort();
}

function csFiles(relativeDirectory) {
  return readdirSync(resolve(repoRoot, relativeDirectory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".cs"))
    .map((entry) => `${relativeDirectory}/${entry.name}`);
}

describe("architecture guardrails", () => {
  test("backend project references follow the layered dependency direction", () => {
    expect(projectReferences("src/backend/German.Domain/German.Domain.csproj")).toEqual([]);
    expect(projectReferences("src/backend/German.Application/German.Application.csproj")).toEqual(["German.Domain"]);
    expect(projectReferences("src/backend/German.Infrastructure/German.Infrastructure.csproj")).toEqual([
      "German.Application",
      "German.Domain",
    ]);
    expect(projectReferences("src/backend/German.Api/German.Api.csproj")).toEqual([
      "German.Application",
      "German.Infrastructure",
    ]);
  });

  test("HTTP endpoint modules do not query EF or DbContext directly", () => {
    const forbidden = ["Microsoft.EntityFrameworkCore", "IGermanDbContext", "German.Application.Abstractions"];
    const violations = csFiles("src/backend/German.Api/Endpoints")
      .flatMap((path) => forbidden.filter((token) => read(path).includes(token)).map((token) => `${path}: ${token}`));

    expect(violations).toEqual([]);
  });

  test("report export keeps OpenXML in Infrastructure", () => {
    const files = [
      ...csFiles("src/backend/German.Application/Reports"),
      ...csFiles("src/backend/German.Api/Endpoints"),
    ];
    const forbidden = ["DocumentFormat.OpenXml", "German.Infrastructure.Excel", "OpenXmlProductionReportExporter"];
    const violations = files
      .flatMap((path) => forbidden.filter((token) => read(path).includes(token)).map((token) => `${path}: ${token}`));

    expect(violations).toEqual([]);
    expect(read("src/backend/German.Application/German.Application.csproj")).not.toContain("DocumentFormat.OpenXml");
    expect(read("src/backend/German.Infrastructure/German.Infrastructure.csproj")).toContain("DocumentFormat.OpenXml");
  });

  test("database lifecycle is split into migrations seed and app start modes", () => {
    const program = read("src/backend/German.Api/Program.cs");
    const migrationsStart = program.indexOf("case StartMode.Migrations:");
    const seedStart = program.indexOf("case StartMode.Seed:");
    const appStart = program.indexOf("case StartMode.App:");
    const middlewareStart = program.indexOf("app.UseDefaultFiles();");

    expect(migrationsStart).toBeGreaterThanOrEqual(0);
    expect(seedStart).toBeGreaterThan(migrationsStart);
    expect(appStart).toBeGreaterThan(seedStart);
    expect(middlewareStart).toBeGreaterThan(appStart);

    const migrationsBlock = program.slice(migrationsStart, seedStart);
    const seedBlock = program.slice(seedStart, appStart);
    const appBlock = program.slice(appStart, middlewareStart);

    expect(migrationsBlock).toContain("Database.MigrateAsync()");
    expect(migrationsBlock).not.toContain("SeedAsync");
    expect(seedBlock).toContain("bootstrapSeeder.SeedAsync");
    expect(seedBlock).not.toContain("MigrateAsync");
    expect(appBlock).not.toContain("MigrateAsync");
    expect(appBlock).not.toContain("SeedAsync");
    expect(read("Dockerfile")).toContain('CMD ["app"]');
  });

  test("production entry feature does not depend on manager feature internals", () => {
    const violations = readdirSync(resolve(repoRoot, "src/frontend/src/features/production-entries"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(js|jsx)$/.test(entry.name))
      .map((entry) => `src/frontend/src/features/production-entries/${entry.name}`)
      .filter((path) => read(path).includes("../manager/"));

    expect(violations).toEqual([]);
  });
});
