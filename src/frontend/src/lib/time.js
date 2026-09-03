export function toApiTime(value) {
  if (!value) {
    return null;
  }

  return value.length === 5 ? `${value}:00` : value;
}
