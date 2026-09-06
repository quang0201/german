export function userAccountForm(account = {}) {
  return {
    username: account.username ?? "",
    password: "",
    role: account.role ?? "Worker",
    employeeId: account.employeeId ?? "",
    isActive: account.isActive ?? true,
  };
}

export function buildUserAccountCreatePayload(form) {
  return {
    username: form.username.trim(),
    password: form.password,
    role: form.role,
    employeeId: form.employeeId || null,
  };
}

export function buildUserAccountUpdatePayload(form) {
  return {
    username: form.username.trim(),
    password: form.password.trim() || null,
    role: form.role,
    employeeId: form.employeeId || null,
    isActive: Boolean(form.isActive),
  };
}
