import { expect, test } from "bun:test";
import { buildProductionExportUrl } from "./productionExportQuery.js";

test("serializes Sunday exclusion on export URLs", () => {
  expect(buildProductionExportUrl({ fromDate: "2026-08-01", untilDate: "2026-08-12", excludeSundays: true }))
    .toContain("excludeSundays=true");
  expect(buildProductionExportUrl({ fromDate: "2026-08-01", untilDate: "2026-08-12", excludeSundays: false }))
    .toContain("excludeSundays=false");
});
