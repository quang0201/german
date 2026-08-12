export function isManagerRole(role) {
  return role === "Manager" || role === "Admin";
}

export function displayName(session) {
  return session?.fullName || session?.username || "Người dùng";
}
