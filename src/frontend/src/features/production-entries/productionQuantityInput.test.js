import { describe, expect, test } from "bun:test";
import { sanitizeProductionQuantityInput } from "./productionQuantityInput.js";

describe("production quantity input", () => {
  test("removes unit text after a quantity", () => {
    expect(sanitizeProductionQuantityInput("220c")).toBe("220");
    expect(sanitizeProductionQuantityInput("1.250 cái")).toBe("1.250");
  });

  test("keeps addition expressions for hour-based allocation", () => {
    expect(sanitizeProductionQuantityInput("220c+80c")).toBe("220+80");
  });

  test("does not turn a negative value into a positive value", () => {
    expect(sanitizeProductionQuantityInput("-220c")).toBe("-220");
  });
});
