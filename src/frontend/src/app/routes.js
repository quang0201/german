import { ProductionEntryFormPage } from "../features/production-entries/ProductionEntryFormPage.jsx";
import { ProductionEntryDetailPage } from "../features/production-entries/ProductionEntryDetailPage.jsx";
import { ProductionEntryRoutePage } from "../features/production-entries/ProductionEntryRoutePage.jsx";
import { EmployeeListPage } from "../features/employees/EmployeeListPage.jsx";
import { ProductionOrderListPage } from "../features/production-orders/ProductionOrderListPage.jsx";
import { ShiftListPage } from "../features/shifts/ShiftListPage.jsx";
import { ReportPage } from "../features/reports/ReportPage.jsx";
import { OverviewPage } from "../features/overview/OverviewPage.jsx";
import { UserAccountPage } from "../features/admin/UserAccountPage.jsx";
import { AuditLogListPage } from "../features/admin/AuditLogListPage.jsx";

export const routes = [
  { path: "/production/new", roles: ["Worker", "Manager", "Admin"], navLabel: "Nhập sản lượng", breadcrumb: () => [{ label: "Nhập sản lượng" }], component: ProductionEntryFormPage },
  { path: "/production", roles: ["Worker", "Manager", "Admin"], navLabel: (role) => role === "Worker" ? "Lịch sử của tôi" : "Sản lượng", breadcrumb: () => [{ label: "Sản lượng", href: "/production" }], component: ProductionEntryRoutePage },
  { path: "/production/:id", roles: ["Worker", "Manager", "Admin"], navLabel: "Sản lượng", breadcrumb: ({ id }) => [{ label: "Sản lượng", href: "/production" }, { label: id }], component: ProductionEntryDetailPage },
  { path: "/overview", roles: ["Manager", "Admin"], navLabel: "Tổng quan", breadcrumb: () => [{ label: "Tổng quan" }], component: OverviewPage },
  { path: "/employees", roles: ["Manager", "Admin"], navLabel: "Nhân viên", breadcrumb: () => [{ label: "Nhân viên" }], component: EmployeeListPage },
  { path: "/employees/:id", roles: ["Manager", "Admin"], navLabel: "Nhân viên", breadcrumb: ({ id }) => [{ label: "Nhân viên", href: "/employees" }, { label: id }], component: EmployeeListPage },
  { path: "/orders/new", roles: ["Manager", "Admin"], navLabel: "Mã sản xuất", breadcrumb: () => [{ label: "Mã sản xuất", href: "/orders" }, { label: "Tạo mới" }], component: ProductionOrderListPage },
  { path: "/orders", roles: ["Manager", "Admin"], navLabel: "Mã sản xuất", breadcrumb: () => [{ label: "Mã sản xuất" }], component: ProductionOrderListPage },
  { path: "/orders/:id", roles: ["Manager", "Admin"], navLabel: "Mã sản xuất", breadcrumb: ({ id }) => [{ label: "Mã sản xuất", href: "/orders" }, { label: id }], component: ProductionOrderListPage },
  { path: "/shifts", roles: ["Manager", "Admin"], navLabel: "Ca làm việc", breadcrumb: () => [{ label: "Ca làm việc" }], component: ShiftListPage },
  { path: "/reports", roles: ["Manager", "Admin"], navLabel: "Báo cáo", breadcrumb: () => [{ label: "Báo cáo" }], component: ReportPage },
  { path: "/admin/accounts", roles: ["Admin"], navLabel: "Tài khoản", breadcrumb: () => [{ label: "Tài khoản" }], component: UserAccountPage },
  { path: "/admin/audit", roles: ["Admin"], navLabel: "Nhật ký kiểm tra", breadcrumb: () => [{ label: "Nhật ký kiểm tra" }], component: AuditLogListPage },
];

function segments(path) {
  return path.split("/").filter(Boolean);
}

export function matchRoute(pathname, routeList = routes) {
  const requested = segments(pathname);
  for (const route of routeList) {
    const pattern = segments(route.path);
    if (pattern.length !== requested.length) continue;
    const params = {};
    const matches = pattern.every((part, index) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(requested[index]);
        return true;
      }
      return part === requested[index];
    });
    if (matches) return { route, params };
  }
  return null;
}

export function getDefaultRoute(role) {
  return role === "Worker" ? "/production/new" : "/production";
}

export function canAccessRoute(route, role) {
  return Boolean(route?.roles?.includes(role));
}
