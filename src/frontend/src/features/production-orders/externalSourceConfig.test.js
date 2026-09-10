import { describe, expect, test } from "bun:test";
import { buildExternalSourcePayload, externalSourceForm } from "./externalSourceConfig.js";

describe("external source config", () => {
  test("builds trimmed active source payload", () => {
    expect(buildExternalSourcePayload({ name: "  Xưởng A  ", isActive: true })).toEqual({ name: "Xưởng A", isActive: true });
  });

  test("defaults new source to active", () => {
    expect(externalSourceForm()).toEqual({ name: "", isActive: true });
  });
});
