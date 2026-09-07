import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dialogSource = readFileSync(resolve(import.meta.dir, "ProductionEntryDialog.jsx"), "utf8");
const listSource = readFileSync(resolve(import.meta.dir, "ProductionEntryListPage.jsx"), "utf8");
const detailSource = readFileSync(resolve(import.meta.dir, "ProductionEntryDetailPage.jsx"), "utf8");

describe("ProductionEntryDialog", () => {
  test("wraps the production entry form in a popup", () => {
    expect(dialogSource).toContain("ProductionEntryFormPage");
    expect(dialogSource).toContain("erp-dialog-backdrop");
    expect(dialogSource).toContain("inPanel");
  });

  test("opens create entry from the list instead of navigating to an inline form", () => {
    expect(listSource).toContain("<ProductionEntryDialog");
    expect(listSource).toContain("setCreateOpen(true)");
    expect(listSource).not.toContain('navigate("/production/new")');
  });

  test("opens edit entry in the same popup pattern", () => {
    expect(detailSource).toContain("<ProductionEntryDialog");
    expect(detailSource).toContain("open={editing}");
    expect(detailSource).not.toContain("if (editing) {");
  });
});
