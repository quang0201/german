export function externalSourceForm(source = {}) {
  return {
    name: source.name ?? "",
    isActive: source.isActive ?? true,
  };
}

export function buildExternalSourcePayload(form) {
  return {
    name: String(form.name ?? "").trim(),
    isActive: Boolean(form.isActive),
  };
}
