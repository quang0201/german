export function attendanceHoursDefaults(attendance, editing = false) {
  if (editing || !attendance?.hasAttendance) {
    return { hcHours: "", tcHours: "" };
  }

  return {
    hcHours: String(attendance.regularHours ?? ""),
    tcHours: String(attendance.overtimeHours ?? ""),
  };
}
