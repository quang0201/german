import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const styles = readFileSync(resolve(import.meta.dir, "../styles.css"), "utf8");

describe("ERP responsive CSS contract", () => {
  test("defines compact sidebar and drawer breakpoints", () => {
    expect(styles).toContain("@media (min-width: 1024px) and (max-width: 1279px)");
    expect(styles).toContain("@media (min-width: 768px) and (max-width: 1023px)");
    expect(styles).toContain("@media (max-width: 767px)");
  });

  test("keeps mobile navigation expanded and locks body scroll", () => {
    expect(styles).toContain("body.erp-mobile-nav-open { overflow: hidden; }");
    expect(styles).toContain(".mobile-nav-open .erp-nav-label { display: block; }");
  });

  test("uses mobile priority columns and multi-row pagination", () => {
    expect(styles).toContain(".erp-column-mobile-hidden { display: none; }");
    expect(styles).toContain(".erp-pagination { grid-template-columns: 1fr auto; gap: 10px 14px; }");
    expect(styles).toContain(".erp-topbar-search { display: none; }");
  });
});
