const roleLabels = {
  Worker: "Công nhân",
  Manager: "Quản lý",
  Admin: "Quản trị viên",
};

const entryModeLabels = {
  ByShift: "Theo ca",
  Direct: "HC / TC trực tiếp",
  TotalWithOvertime: "Tổng + giờ tăng ca",
};

const orderStatusLabels = {
  Draft: "Nháp",
  InProduction: "Đang sản xuất",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
};

const actionLabels = {
  Create: "Tạo mới",
  Update: "Cập nhật",
  Delete: "Xóa",
  Login: "Đăng nhập",
  Logout: "Đăng xuất",
};

const entityTypeLabels = {
  ProductionEntry: "Sản lượng",
  Employee: "Nhân viên",
  ProductionOrder: "Mã sản xuất",
  ProductionOperation: "Công đoạn",
  UserAccount: "Tài khoản",
  ShiftTemplate: "Bộ ca",
};

export function roleLabel(value) { return roleLabels[value] || value || "Người dùng"; }
export function entryModeLabel(value) { return entryModeLabels[value] || value || "—"; }
export function orderStatusLabel(value) { return orderStatusLabels[value] || value || "—"; }
export function actionLabel(value) { return actionLabels[value] || value || "—"; }
export function entityTypeLabel(value) { return entityTypeLabels[value] || value || "—"; }
