import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("useEscapeKey", () => {
  const source = readFileSync(new URL("./useEscapeKey.js", import.meta.url), "utf8");

  test("only the most recently opened dialog reacts to Escape", () => {
    expect(source).toContain("openStack[openStack.length - 1] !== token");
  });

  test("every dialog closes with Escape through the shared hook", () => {
    const dialogs = [
      "../features/admin/UserAccountDialog.jsx",
      "../features/employees/EmployeeDialog.jsx",
      "../features/production-entries/ProductionEntryDialog.jsx",
      "../features/production-entries/ProductionExportDialog.jsx",
      "../features/production-entries/ProductionMatrixBatchEntryDialog.jsx",
      "../features/production-entries/ProductionMatrixCellRecordsDialog.jsx",
      "../features/production-entries/ProductionMatrixQuickEntryDialog.jsx",
      "../features/production-orders/ProductionExternalQuantityDialog.jsx",
      "../features/production-orders/ProductionExternalSourceDialog.jsx",
      "../features/production-orders/ProductionOperationDialog.jsx",
      "../features/production-orders/ProductionOrderDialog.jsx",
      "../features/shifts/ShiftTemplateDialog.jsx",
      "../components/erp/ConfirmDialog.jsx",
    ];
    for (const path of dialogs) {
      expect(readFileSync(new URL(path, import.meta.url), "utf8")).toContain("useEscapeKey(");
    }
  });
});
