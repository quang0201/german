export function employeeForm(employee = {}) {
  return {
    employeeCode: employee.employeeCode ?? "",
    fullName: employee.fullName ?? "",
    dateOfBirth: employee.dateOfBirth ?? "",
    isActive: employee.isActive ?? true,
    deactivatedAt: employee.deactivatedAt ?? "",
    compensationType: employee.compensationType ?? "PieceRate",
  };
}

export function buildEmployeeUpdatePayload(form) {
  return {
    employeeCode: form.employeeCode.trim(),
    fullName: form.fullName.trim(),
    dateOfBirth: form.dateOfBirth || null,
    isActive: Boolean(form.isActive),
    deactivatedAt: form.isActive ? null : (form.deactivatedAt || null),
    compensationType: form.compensationType ?? "PieceRate",
  };
}

export function buildEmployeeShiftAssignmentPayload(form) {
  return {
    shiftTemplateId: form.shiftTemplateId,
    effectiveFrom: form.effectiveFrom,
  };
}
