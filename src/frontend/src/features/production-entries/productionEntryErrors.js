export function mapProductionEntryError(error, fallback = "Không thể hoàn tất thao tác.") {
  if (!error) return fallback;
  if (error.code === "production_entry.cell_conflict") {
    return "Ô sản lượng đã được ghi bởi người khác. Hãy tải lại ma trận.";
  }
  if (error.status === 409 || error.code === "production_entry.version_conflict") {
    return "Dữ liệu đã được thay đổi bởi người khác.";
  }
  if (error.code === "production_entry.not_found") {
    return "Không tìm thấy sản lượng này hoặc dữ liệu đã bị xóa mềm.";
  }
  if (error.code === "production_entry.read_forbidden") {
    return "Bạn không có quyền xem sản lượng này.";
  }
  if (error.code === "production_entry.history_forbidden") {
    return "Tài khoản chưa được gắn với hồ sơ nhân viên.";
  }
  if (error.code === "production_entry.validation_failed") {
    return "Dữ liệu sản lượng chưa hợp lệ. Vui lòng kiểm tra lại các trường nhập.";
  }
  return error.message || fallback;
}

export function isVersionConflict(error) {
  return Boolean(error && (error.status === 409 || error.code === "production_entry.version_conflict"));
}
