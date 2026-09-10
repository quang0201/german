export function attendanceHoursDefaults(attendance, editing = false) {
  if (editing || !attendance?.hasAttendance) {
    return { hcHours: "0", tcHours: "0" };
  }

  return {
    hcHours: String(attendance.regularHours ?? "0"),
    tcHours: String(attendance.overtimeHours ?? "0"),
  };
}
