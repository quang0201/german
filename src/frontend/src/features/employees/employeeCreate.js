function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function employeeCreateForm(employee = {}, today = localToday()) {
  return {
    employeeCode: employee.employeeCode ?? "",
    fullName: employee.fullName ?? "",
    shiftTemplateId: employee.shiftTemplateId ?? "",
    effectiveFrom: employee.effectiveFrom ?? today,
  };
}

export function buildEmployeeCreatePayload(form) {
  return {
    employeeCode: form.employeeCode.trim(),
    fullName: form.fullName.trim(),
    shiftTemplateId: form.shiftTemplateId || null,
    effectiveFrom: form.effectiveFrom || null,
  };
}
