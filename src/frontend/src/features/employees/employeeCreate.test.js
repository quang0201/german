import { describe, expect, test } from "bun:test";
import { buildEmployeeCreatePayload, employeeCreateForm } from "./employeeCreate.js";

describe("employee create flow", () => {
  test("initializes the shift assignment date and empty selection", () => {
    expect(employeeCreateForm({}, "2026-08-17")).toEqual({
      employeeCode: "",
      fullName: "",
      dateOfBirth: "",
      shiftTemplateId: "",
      effectiveFrom: "2026-08-17",
      compensationType: "PieceRate",
    });
  });

  test("builds an atomic employee create payload with shift assignment", () => {
    expect(buildEmployeeCreatePayload({
      employeeCode: " E001 ",
      fullName: " Nguyễn Văn An ",
      dateOfBirth: "1995-04-12",
      shiftTemplateId: "shift-1",
      effectiveFrom: "2026-08-17",
    })).toEqual({
      employeeCode: "E001",
      fullName: "Nguyễn Văn An",
      dateOfBirth: "1995-04-12",
      shiftTemplateId: "shift-1",
      effectiveFrom: "2026-08-17",
      compensationType: "PieceRate",
    });
  });
});
