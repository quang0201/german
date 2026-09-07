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
    const employeeSource = read("src/features/employees/EmployeeListPage.jsx");
    expect(employeeSource).toContain('<EmployeeDialog mode="create"');

    const accountSource = read("src/features/admin/UserAccountPage.jsx");
    expect(accountSource).toContain('<UserAccountDialog mode="create"');
    expect(accountSource).toContain('<UserAccountDialog mode="edit"');

    const shiftSource = read("src/features/shifts/ShiftListPage.jsx");
    expect(shiftSource).toContain('<ShiftTemplateDialog mode="create"');

    const orderSource = read("src/features/production-orders/ProductionOrderListPage.jsx");
    expect(orderSource).toContain("<ProductionOrderDialog");
    expect(orderSource).toContain('mode="create"');
  });
});
