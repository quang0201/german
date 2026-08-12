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

  test("production entry feature does not depend on manager feature internals", () => {
    const violations = readdirSync(resolve(repoRoot, "src/frontend/src/features/production-entries"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(js|jsx)$/.test(entry.name))
      .map((entry) => `src/frontend/src/features/production-entries/${entry.name}`)
      .filter((path) => read(path).includes("../manager/"));

    expect(violations).toEqual([]);
  });
});
