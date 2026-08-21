import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeDialog } from "./EmployeeDialog.jsx";
import { buildEmployeeShiftAssignmentPayload, buildEmployeeUpdatePayload, employeeForm } from "./employeeDialog.js";

describe("EmployeeDialog", () => {
  const employee = { id: "employee-1", employeeCode: "E001", fullName: "Nguyễn Văn An", isActive: true };

  test("does not render when closed", () => {
    expect(renderToStaticMarkup(<EmployeeDialog open={false} />)).toBe("");
  });

  test("renders editable employee name", () => {
    const html = renderToStaticMarkup(<EmployeeDialog open employee={employee} onClose={() => {}} onSubmit={() => {}} />);

    expect(html).toContain("Sửa nhân viên");
    expect(html).toContain('value="E001"');
    expect(html).toContain('value="Nguyễn Văn An"');
    expect(html).toContain("Lưu thay đổi");
  });

  test("renders shift selection when creating an employee", () => {
    const html = renderToStaticMarkup(<EmployeeDialog mode="create" open shifts={[{ id: "shift-1", name: "Ca hành chính", isActive: true }]} onClose={() => {}} onSubmit={() => {}} />);

    expect(html).toContain("Thêm nhân viên");
    expect(html).toContain("Bộ ca HC");
    expect(html).toContain("Ca hành chính");
    expect(html).toContain("Ngày hiệu lực");
  });

  test("offers a separate effective-date shift assignment when editing", () => {
    const html = renderToStaticMarkup(<EmployeeDialog
      open
      employee={employee}
      shifts={[{ id: "shift-1", name: "Ca hành chính", isActive: true }]}
      onClose={() => {}}
      onSubmit={() => {}}
      onAssignShift={() => {}}
    />);

    expect(html).toContain("Điều chỉnh bộ ca");
    expect(html).toContain("Gán bộ ca mới");
    expect(html).toContain("Ngày hiệu lực");
    expect(html).toContain("Lịch sử ca cũ được giữ nguyên");
  });

  test("builds update payload with trimmed employee fields", () => {
    expect(buildEmployeeUpdatePayload({ ...employeeForm(employee), employeeCode: " E002 ", fullName: " Trần Thị B ", isActive: false })).toEqual({
      employeeCode: "E002",
      fullName: "Trần Thị B",
      isActive: false,
    });
  });

  test("builds an effective-date shift assignment payload", () => {
    expect(buildEmployeeShiftAssignmentPayload({ shiftTemplateId: "shift-1", effectiveFrom: "2026-08-21" }))
      .toEqual({ shiftTemplateId: "shift-1", effectiveFrom: "2026-08-21" });
  });
});
