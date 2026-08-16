export function employeeForm(employee = {}) {
  return {
    employeeCode: employee.employeeCode ?? "",
    fullName: employee.fullName ?? "",
    isActive: employee.isActive ?? true,
  };
}

export function buildEmployeeUpdatePayload(form) {
  return {
    employeeCode: form.employeeCode.trim(),
    fullName: form.fullName.trim(),
    isActive: Boolean(form.isActive),
  };
}
