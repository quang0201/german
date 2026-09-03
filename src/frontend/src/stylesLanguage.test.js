import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const styles = readFileSync(resolve(import.meta.dir, "styles.css"), "utf8");

describe("ERP typography", () => {
  test("uses Roboto as the primary UI font", () => {
    expect(styles).toContain("Roboto");
    expect(styles).toContain("fonts.googleapis.com/css2?family=Roboto");
  });
});
