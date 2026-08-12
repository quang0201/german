# ERP Frontend Redesign — Design Specification

Ngày: 2026-08-12

## 1. Mục tiêu

Redesign frontend German Production theo hướng ERP thực tế, lấy cảm hứng từ SAP Fiori, Microsoft Dynamics 365 và Odoo:

- ERP Shell cố định với navigation theo role.
- List → Search/Filter → Form → Detail là pattern chính.
- Mật độ dữ liệu cao, ưu tiên thao tác nhanh và đọc nhanh.
- Dashboard chỉ là workspace tổng hợp, không phải màn hình mặc định cho mọi nghiệp vụ.
- Các feature độc lập, không tạo lại một `ManagerWorkspace` khổng lồ.

Phase này chủ yếu thay đổi frontend, nhưng có một thay đổi backend có kiểm soát cho read/query path của ProductionEntry. Không thay đổi domain calculation, EF entity, schema, migration, Excel export contract hoặc business authorization của create/update/delete.

## 2. Phạm vi triển khai

Thứ tự triển khai:

1. ERP tokens và shared components.
2. AppShell, Sidebar, Topbar, Breadcrumbs và pathname routing.
3. Production List Report.
4. Production Entry Form.
5. Production Entry Detail/Edit flow.
6. Worker mobile adaptation.
7. Employees.
8. Production Orders và Operations.
9. Shifts.
10. Reports.
11. Admin Accounts và Audit.
12. Manager overview dashboard.

Dashboard được làm cuối và chỉ chứa summary, exceptions/việc cần xử lý và shortcuts. Dashboard không chứa CRUD đầy đủ hoặc workflow nghiệp vụ phức tạp.

## 3. Kiến trúc frontend

```text
src/frontend/src/
├─ app/
│  ├─ App.jsx
│  ├─ AppShell.jsx
│  ├─ Sidebar.jsx
│  ├─ Topbar.jsx
│  ├─ Breadcrumbs.jsx
│  ├─ routes.js
│  └─ session.js
├─ components/
│  └─ erp/
│     ├─ PageHeader.jsx
│     ├─ FilterBar.jsx
│     ├─ DataTable.jsx
│     ├─ StatusBadge.jsx
│     ├─ FormSection.jsx
│     ├─ Field.jsx
│     ├─ DetailPanel.jsx
│     ├─ ConfirmDialog.jsx
│     ├─ Alert.jsx
│     ├─ Toast.jsx
│     ├─ ToastProvider.jsx
│     ├─ InlineMessage.jsx
│     └─ EmptyState.jsx
├─ features/
│  ├─ production-entries/
│  ├─ employees/
│  ├─ production-orders/
│  ├─ shifts/
│  ├─ reports/
│  └─ admin/
└─ lib/
   ├─ api.js
   └─ ...
```

`App.jsx` chỉ kiểm tra session, xử lý login/logout, resolve route và render shell/page. `AppShell` chỉ quản lý shell state như sidebar collapsed, navigation và session display; không giữ filter, form hoặc mutation state của feature.

Mỗi feature tự sở hữu page, API loading, filter state, mutation state và refresh flow. Feature không import internals của feature khác. Nếu cần cùng một lookup, mỗi feature gọi API riêng hoặc logic generic được đưa xuống `lib`.

`ManagerApp` là code chuyển đổi tạm thời nếu cần. Sau redesign, `App → router → AppShell → feature pages`; `ManagerApp` không còn dependency runtime và được xóa khi không còn consumer.

## 4. Routing và navigation

Không thêm router dependency. Router nhỏ dùng `window.location.pathname`, `history.pushState()` và `popstate`.

`routes.js` là nguồn duy nhất cho metadata điều hướng:

```js
{
  path: "/production/:id",
  roles: ["Worker", "Manager", "Admin"],
  navLabel: "Sản lượng",
  breadcrumb: ({ id }) => [
    { label: "Sản lượng", href: "/production" },
    { label: id },
  ],
  component: ProductionEntryDetailPage,
}
```

Route metadata chỉ chứa path, segment matcher, role metadata dùng cho UX, breadcrumb, nav label và component. `navLabel` có thể là label tĩnh hoặc resolver theo role để cùng route hiển thị `Lịch sử của tôi` cho Worker và `Sản lượng` cho Manager/Admin; resolver này chỉ phục vụ navigation display. Không đưa API calls, filter state, mutation, calculation hoặc feature-specific business permission vào `routes.js`.

Router match theo segment. `/orders/new` phải được match trước hoặc khác với `/orders/:id`; không dùng `startsWith` để suy đoán route.

Các route chính:

```text
/production
/production/new
/production/:id
/employees
/employees/:id
/orders
/orders/:id
/shifts
/reports
/admin/accounts
/admin/audit
/overview
```

Default route:

```text
Worker  → /production/new
Manager → /production
Admin   → /production
```

Router phải có các trạng thái rõ ràng:

```text
404              → NotFoundPage
Không đủ role UI  → AccessDeniedPage
Session hết hạn   → LoginPage hoặc SessionExpiredPage
```

Route role chỉ là UX/menu metadata. Backend vẫn là authorization boundary.

Sidebar đọc route metadata và hiển thị:

```text
Worker
├─ Nhập sản lượng
└─ Lịch sử của tôi

Manager
├─ Tổng quan
├─ Sản lượng
├─ Nhân viên
├─ Mã sản xuất
├─ Ca làm việc
└─ Báo cáo

Admin
├─ tất cả menu Manager
├─ Tài khoản
└─ Audit log
```

## 5. ERP visual system

Visual tokens là nguồn sự thật chung trong `styles.css` hoặc file token được import từ đó. Feature không tạo design system riêng.

```css
:root {
  --color-primary: #1d4ed8;
  --color-primary-hover: #1e40af;
  --color-primary-soft: #eff6ff;
  --color-bg: #f3f4f6;
  --color-surface: #ffffff;
  --color-border: #d1d5db;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --radius-sm: 4px;
  --radius-md: 6px;
  --control-height: 38px;
  --table-row-height: 42px;
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 64px;
}
```

Các giá trị trên là baseline duy nhất trong phase. Layout vẫn có thể dùng Tailwind utilities như `flex`, `grid`, `gap` và responsive classes; màu, radius, control size và table density phải dùng token thay vì rải các shade/radius khác nhau trong feature.

Quy tắc visual:

- nền app xám rất nhạt, surface trắng, border rõ nhưng nhẹ;
- body text khoảng 14px, page title 20–24px;
- input cao khoảng 38px, table row khoảng 42px;
- radius 4–6px, shadow tối thiểu;
- table là surface chính cho dữ liệu lặp;
- card chỉ dùng khi thực sự cần grouping;
- primary color chỉ dùng cho CTA chính;
- semantic colors chỉ dùng cho status và feedback;
- mobile Manager/Admin không biến table thành một danh sách card dày đặc; dùng horizontal scroll có chủ đích, sticky cột quan trọng hoặc chuyển detail sang full page.

## 6. Shared component contracts

Shared components là presentation primitives. Chúng không gọi API, không chứa business calculation và không biết business status mapping.

### `StatusBadge`

Chỉ nhận semantic variant và children:

```jsx
<StatusBadge variant="success">Đang hoạt động</StatusBadge>
```

Không nhận business `status` rồi tự map `Active`, `Deleted`, `Completed`.

### `DataTable`

Contract tối thiểu:

```text
columns
rows
loading
error
emptyMessage
density: compact | normal
rowKey
onRowClick
selectedRowKey optional
```

Component phải có loading, error và empty state thống nhất; không render lỗi business tùy tiện.

### `Field`

```text
label
required
hint
error
children
htmlFor
```

### `FilterBar`

```text
children
loading
onSubmit
onReset
```

### `DetailPanel`

```text
open
title
onClose
children
```

Desktop có thể render panel bên phải; mobile dùng detail page.

### Feedback components

- `Toast`: thông báo ngắn sau hành động, ví dụ save thành công/thất bại.
- `ToastProvider`: cung cấp `toast.success/error/info` ở app level.
- `Alert`: thông báo quan trọng ở cấp trang hoặc detail.
- `InlineMessage`: thông báo sát section hoặc field.
- `EmptyState`: list/table không có dữ liệu.
- `ConfirmDialog`: hành động phá hủy như soft delete.

Không dùng `alert()`, `window.alert`, `window.confirm`, `window.prompt` hoặc `console.error()` làm feedback cho user. Feature phải map API error code thành copy phù hợp rồi truyền vào component chung. `ConfirmDialog` phải hỗ trợ Escape khi được phép, focus khi mở, trả focus về trigger khi đóng, nút phá hủy không phải default action và loading state chống double-submit.

## 7. Production List Report

`ProductionEntryListPage` tại `/production` là màn hình chuẩn để khóa design language cho Manager/Admin.

Layout:

```text
PageHeader
  Sản lượng
  Theo dõi và quản lý sản lượng sản xuất
  + Nhập sản lượng | Xuất Excel

FilterBar
  Từ ngày | Đến ngày | Nhân viên | Mã SX | Công đoạn | Tìm kiếm
  Lọc | Xóa lọc

DataTable compact
  Ngày | Mã NV | Họ tên | Mã SX | CĐ | HC | TC | Tổng | Kiểu nhập | Thao tác

Pagination
  1–50 / totalCount | page navigation | pageSize 25/50/100
```

Không tạo business status giả cho ProductionEntry; cột cuối là `Thao tác`.

### Backend query contract

```http
GET /api/production-entries
  ?fromDate=2026-08-01
  &untilDate=2026-08-31
  &employeeId=...
  &orderId=...
  &operationId=...
  &search=E001
  &page=1
  &pageSize=50
```

Response shape cố định:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 50,
  "totalCount": 0,
  "totalPages": 0
}
```

Rules:

- `pageSize` chỉ nhận `25`, `50`, `100`; giá trị khác trả `400`, không âm thầm clamp.
- Không truyền ngày: `today..today`.
- Chỉ `fromDate`: `fromDate..fromDate`.
- Chỉ `untilDate`: `untilDate..untilDate`.
- Cả hai: inclusive range.
- Range lớn hơn 31 ngày inclusive trả `400` cho List Report.
- `date` cũ được hỗ trợ để tương thích: nếu có `date` thì không được truyền `fromDate` hoặc `untilDate`; truyền đồng thời trả `400`; `date` được hiểu là ngày bắt đầu và kết thúc.
- `search` được trim; rỗng/whitespace nghĩa là không search.
- Search trên mã nhân viên, họ tên, mã sản xuất, tên sản phẩm, tên công đoạn và biểu diễn kiểu nhập theo application contract.
- Filter theo ngày/employee/order/operation/search chạy trước `CountAsync`.
- Sort ổn định: `WorkDate DESC`, `EmployeeCode ASC`, `OperationNumber ASC`, `CreatedAt ASC`, `Id ASC`, sau đó `Skip/Take`.
- `items` luôn là array, kể cả khi không có dữ liệu.
- Soft-deleted entry không xuất hiện.
- Excel export giữ endpoint và contract hiện tại, không bị thay đổi bởi query list.

Authorization:

- Manager/Admin đọc được list toàn bộ theo filter.
- Worker chỉ đọc được lịch sử của chính mình nếu gọi read list/history route.
- Worker không được update/delete; thay đổi read query không mở quyền mutation.
- Backend vẫn là security boundary, không dựa vào việc ẩn menu frontend.

### Detail navigation

Từ list desktop, click row dùng `pushState` tới `/production/:id`, giữ list mounted và mở `DetailPanel`. Refresh/deep-link hoặc mobile render `ProductionEntryDetailPage` độc lập. Không cần khôi phục panel sau refresh.

## 8. Production Entry Detail/Edit

Read endpoint:

```http
GET /api/production-entries/{id}
```

Semantics:

```text
200 → tồn tại và user có quyền đọc
404 → không tồn tại hoặc đã soft-delete
403 → tồn tại nhưng user không có quyền đọc
```

Detail nhóm theo nội dung phẳng:

```text
Thông tin chung
Ngày · Nhân viên · Mã SX · Công đoạn · Người nhập

Kết quả sản lượng
HC · TC · Tổng · Giờ TC · Kiểu nhập

Bối cảnh
Thời gian làm · Ghi chú · Created/Updated

Thao tác
Sửa · Xóa mềm · Đóng
```

Edit dùng chung presentation với create form nhưng không dùng modal. Có thể chuyển panel/page sang edit state hoặc dùng route nội bộ rõ ràng. Form giữ `version`.

Version conflict thống nhất:

```text
PUT/DELETE → 409 Conflict
           → Alert: "Dữ liệu đã được thay đổi bởi người khác."
           → nút "Tải lại dữ liệu"
```

Không tự overwrite và không tự submit lại.

Mutation synchronization:

```text
Create → Toast success → quay lại/list và refresh query hiện tại
Edit   → reload detail từ server → refresh current list page
Delete → ConfirmDialog → đóng detail → refresh current list page → Toast success
```

Frontend không tự patch nhiều row state khi server đã có pagination/sort/filter; refetch query hiện tại là nguồn sự thật.

## 9. Production Entry Form

Routes:

```text
/production/new
/production/:id → detail, có action Sửa
```

Form sections:

```text
Thông tin chung
Nhân viên · Ngày · Mã sản xuất · Công đoạn

Sản lượng
Chế độ nhập · các field phụ thuộc mode

Kết quả tính toán
HC · TC · Tổng dạng bảng số liệu phẳng

Thời gian và ghi chú
```

Worker không thấy selector nhân viên; Manager/Admin nhập thay sẽ chọn nhân viên ở đầu form. Mode switch không làm mất raw values đã nhập, nhưng payload chỉ gửi field của mode hiện tại.

Action bar:

```text
Hủy | Lưu & nhập tiếp | Lưu
```

Worker mobile dùng sticky bottom action bar. Desktop dùng action bar cuối form. Không dùng modal.

Frontend preview chỉ mirror calculation cho UX. Backend/application calculation là authoritative và kết quả sau khi lưu phải được hiển thị từ response/server.

## 10. Feature pages còn lại

Mỗi feature dùng List → Filter/Search → Detail → Form:

```text
features/employees/
  EmployeeListPage
  EmployeeDetailPage
  EmployeeFormPage

features/production-orders/
  ProductionOrderListPage
  ProductionOrderDetailPage
  ProductionOrderFormPage

features/shifts/
  ShiftListPage
  ShiftDetailPage
  ShiftFormPage
  ShiftAssignmentSection

features/reports/
  ProductionReportPage

features/admin/
  UserAccountListPage
  UserAccountFormPage
  AuditLogListPage
```

Employee local search là giới hạn có chủ ý theo API hiện tại; không áp dụng pattern này mặc định cho ProductionEntry. ProductionOrder operations là table trong detail, không tạo workspace riêng. Reports dùng filter và export endpoint, không thay bằng dashboard. Audit là read-only.

## 11. Responsive behavior

- Desktop Manager/Admin: sidebar + table + detail panel.
- Mobile Worker: shell gọn, form một cột, control/action lớn, sticky action bar.
- Mobile Manager/Admin: giữ mật độ table bằng horizontal scroll có chủ đích, sticky cột quan trọng hoặc chuyển detail sang full page; không chuyển toàn bộ table thành các card record.
- Deep-link production detail trên mobile luôn là full page.

## 12. Testing và architecture guardrails

Frontend tests phải bao phủ:

- route config có path/roles/breadcrumb/component hợp lệ;
- segment matcher phân biệt `/orders/new` và `/orders/:id`;
- default route theo role;
- access denied, 404 và session expired;
- shared components có loading/error/empty behavior;
- `ConfirmDialog` focus, Escape và loading behavior ở mức phù hợp;
- production query builder serialize date/filter/search/page/pageSize đúng;
- production list render pagination server-side và refresh sau mutation;
- detail deep-link và panel context;
- version conflict hiển thị Alert và không tự submit;
- Worker không thấy mutation actions;
- form preview vẫn chỉ là preview và submit đúng payload mode.

Architecture tests phải chặn:

```text
components/erp → không import features/*
feature A      → không import internals feature B
features/*    → không import ManagerApp
shared/shell   → không chứa business calculation
```

Static guardrails phải chặn `alert(`, `window.alert`, `window.confirm`, `window.prompt` trong frontend source. `StatusBadge` chỉ nhận semantic variant; shared components không chứa mapping business status hoặc `ProductionEntryMode` calculation. Visual tokens là shared source of truth; feature không tạo token/design system riêng.

Backend tests cần bổ sung cho read/query path:

- date default/single-sided/inclusive range;
- `date` compatibility và conflict với from/until;
- max 31-day range;
- pageSize whitelist;
- search trim và field matching;
- filter trước count/pagination;
- stable sort có Id tie-breaker;
- fixed empty response shape;
- soft-delete exclusion;
- Manager/Admin list authorization;
- Worker ownership read và 403/404 semantics của detail.

Không thay đổi hoặc test lại ngoài phạm vi phase này:

- `ProductionCalculator` behavior;
- EF schema/migrations;
- Excel export contract;
- update/delete authorization model;
- hard delete behavior.

## 13. Rollout và hoàn thành

Migration được thực hiện theo từng bước feature, nhưng mọi bước phải giữ build/test xanh. Sau khi implementation hoàn tất:

```bash
cd src/frontend
bun test
bun run build

dotnet build German.sln --configuration Release
dotnet test German.sln --configuration Release

bash -n deploy.sh
./deploy.sh update
```

`./deploy.sh update` chỉ thực hiện sau khi thay đổi đã được commit/merge vào branch `dev` theo workflow hiện tại. Deployment không tự seed; update không checkout hoặc merge `main`.

## 14. Ngoài phạm vi

- React Router hoặc UI framework mới.
- Redesign backend domain/business calculation.
- Migration/schema changes.
- Server-side query cho Employees/Orders/Shifts trong phase này nếu API chưa hỗ trợ.
- Dashboard-first redesign.
- Bulk edit/import/export mới ngoài Excel export hiện có.
- Hard delete.
- Tự động khôi phục DetailPanel sau refresh.
