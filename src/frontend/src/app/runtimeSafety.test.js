import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dir, "../..");

function read(relativePath) {
  return readFileSync(resolve(frontendRoot, relativePath), "utf8");
}

describe("frontend runtime safety", () => {
  test("builds root-relative assets so nested routes survive a direct load", () => {
    const packageJson = JSON.parse(read("package.json"));

    expect(packageJson.scripts.build).toContain("--public-path /");
  });

  test("data-loading effects do not return promises as React cleanup callbacks", () => {
    for (const path of [
      "src/features/shifts/ShiftListPage.jsx",
      "src/features/admin/UserAccountPage.jsx",
    ]) {
      const source = read(path);

      expect(source).not.toContain("useEffect(load, []);");
      expect(source).toContain("useEffect(() => { load(); }, []);");
    }
  });

  test("create-form controls participate in native validation", () => {
    const cases = [
      ["src/features/production-orders/ProductionOrderListPage.jsx", "order-create", 5],
      ["src/features/shifts/ShiftListPage.jsx", "shift-create", 2],
      ["src/features/admin/UserAccountPage.jsx", "account-create", 5],
    ];

    for (const [path, formId, expectedAssociations] of cases) {
      const source = read(path);
      const associations = source.match(new RegExp(`form="${formId}"`, "g")) || [];

      expect(source).toContain(`<form id="${formId}"`);
      expect(associations).toHaveLength(expectedAssociations);
    }

    const employeeSource = read("src/features/employees/EmployeeListPage.jsx");
    expect(employeeSource).toContain('<EmployeeDialog mode="create"');
  });
});
