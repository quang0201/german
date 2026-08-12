# ERP Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Chuyển German Production sang ERP Shell + role-based navigation + List/Filter/Form/Detail workflows, đồng thời bổ sung các backend read-only contracts cần thiết cho production pagination, Worker history, detail và Admin audit.

**Architecture:** Giữ React + Bun + Tailwind và pathname router tự viết, không thêm router/UI/state dependency. routes.js là nguồn metadata điều hướng; AppShell chỉ quản lý shell state; mỗi feature tự quản lý API/query/mutation state. Backend chỉ mở rộng Application/API read/query services, không đổi Domain, entity, schema, migration, calculation hoặc mutation authorization.

**Tech Stack:** .NET 10, ASP.NET Core Minimal API, EF Core 10, React 19, Bun 1.3.14, Tailwind CSS 4.3.0, MSTest, Bun test, react-dom/server cho smoke rendering shared components khi cần.

## Global Constraints

- Không thêm React Router, UI framework, state-management library, testing framework hoặc thư viện frontend mới.
- routes.js chỉ chứa path, segment matcher, role metadata UX, navLabel, breadcrumb, component; không chứa API call, filter state, mutation, calculation hoặc business permission.
- Backend authorization là security boundary; role-based menu chỉ là UX.
- Shared ERP components không import feature; feature không import internals feature khác hoặc ManagerApp.
- Không dùng alert(), window.alert, window.confirm, window.prompt hoặc console output làm feedback user.
- StatusBadge chỉ nhận semantic variant và children; không map business status hoặc ProductionEntryMode.
- Visual tokens là nguồn sự thật chung; feature không tạo token/design system riêng.
- Production List Report dùng server-side query; page mặc định 1, pageSize mặc định 50, whitelist 25|50|100.
- List date range inclusive tối đa 31 ngày; date cũ không được truyền cùng fromDate/untilDate.
- List sort ổn định: WorkDate DESC, EmployeeCode ASC, OperationNumber ASC, CreatedAt ASC, Id ASC.
- page > totalPages trả 200, items rỗng, giữ nguyên page request.
- Worker history dùng /api/production-entries/mine với ownership lấy từ authenticated actor.
- Production detail trả ProductionEntryDetailDto có raw edit fields, calculated fields, display fields, version và submitted-user display fields.
- Audit read dùng /api/audit-logs, policy AdminOnly, không thêm mutation/migration.
- GET /api/production-entries/{id} trả 200 khi có quyền đọc, 404 khi không tồn tại/soft-deleted, 403 khi tồn tại nhưng không có quyền đọc.
- Edit/delete version conflict trả 409; UI hiển thị Alert và nút reload, không tự overwrite/retry.
- TDD: mỗi behavior mới phải có test đỏ trước implementation, sau đó green và refactor.

---

### Task 1: Shared paged read contracts and production list query

Files:

- Create src/backend/German.Application/Common/PagedResult.cs
- Create src/backend/German.Application/ProductionEntries/ProductionEntryListQuery.cs
- Modify src/backend/German.Application/ProductionEntries/ProductionEntryQueryService.cs
- Modify src/backend/German.Api/Endpoints/ProductionEntryEndpoints.cs
- Test tests/German.Application.Tests/ProductionEntries/ProductionEntryQueryServiceTests.cs
- Test tests/German.Api.Tests/ProductionEntryQueryApiTests.cs

Interfaces:

    public sealed record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages);

    public sealed record ProductionEntryListQuery(
        DateOnly? Date,
        DateOnly? FromDate,
        DateOnly? UntilDate,
        Guid? EmployeeId,
        Guid? OrderId,
        Guid? OperationId,
        string? Search,
        int? Page,
        int? PageSize);

    public Task<AppResult<PagedResult<ProductionEntryListItemDto>>> ListAsync(
        ProductionEntryListQuery query,
        CancellationToken cancellationToken);

Normalize date defaults exactly as the spec defines: no date means UTC today..today; one-sided values become a single-day range; both values are inclusive. Reject conflicting legacy date plus fromDate/untilDate, reversed dates, range over 31 inclusive days, page below 1, invalid page and pageSize outside 25/50/100. Trim search and treat empty/whitespace as null. Apply every predicate before CountAsync, then stable OrderBy, then Skip/Take. Return totalPages 0 for empty results and preserve requested page when it exceeds total pages. Search employee code/name, order code/product name, operation name and the application-level entry-mode text contract.

- [ ] Step 1: Write failing application tests for date normalization, conflicting date inputs, invalid range/page/pageSize, trimmed search, filter-before-count, stable tie-break ordering and out-of-range page.
- [ ] Step 2: Run the focused application tests and confirm they fail because the paged query contract does not exist.
- [ ] Step 3: Implement the minimal paged result and query normalization; keep endpoint code limited to HTTP parameter mapping and result-to-status mapping.
- [ ] Step 4: Add API integration tests for manager response shape, empty pages, 400 validation cases and legacy date compatibility.
- [ ] Step 5: Run focused Application and API tests and confirm all new cases pass.
- [ ] Step 6: Commit with feat: add paged production entry query.

### Task 2: Worker history and production detail read contracts

Files:

- Create src/backend/German.Application/ProductionEntries/ProductionEntryDetailDto.cs
- Modify src/backend/German.Application/ProductionEntries/ProductionEntryQueryService.cs to own list, mine and detail read projections
- Modify src/backend/German.Api/Endpoints/ProductionEntryEndpoints.cs
- Modify src/backend/German.Api/Program.cs only for a new service registration if needed
- Test tests/German.Application.Tests/ProductionEntries/ProductionEntryReadServiceTests.cs
- Test tests/German.Api.Tests/ProductionEntryReadApiTests.cs

Interfaces:

    public sealed record ProductionEntryDetailDto(
        Guid Id,
        int Version,
        DateOnly WorkDate,
        Guid EmployeeId,
        string EmployeeCode,
        string EmployeeName,
        Guid ProductionOrderId,
        string ProductionOrderCode,
        string ProductName,
        Guid ProductionOperationId,
        int OperationNumber,
        string OperationName,
        string Unit,
        ProductionEntryMode EntryMode,
        decimal? Shift1Quantity,
        decimal? Shift2Quantity,
        decimal? DirectHcQuantity,
        decimal? DirectTcQuantity,
        decimal? TotalInputQuantity,
        decimal? OvertimeHours,
        decimal? OvertimeQuantity,
        TimeOnly? WorkStart,
        TimeOnly? WorkEnd,
        decimal HcQuantity,
        decimal TcQuantity,
        decimal TotalQuantity,
        string? Note,
        Guid SubmittedByUserId,
        string SubmittedByUsername,
        string? SubmittedByEmployeeCode,
        string? SubmittedByEmployeeName,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);

Add GET /api/production-entries/mine before the /{id} route. It uses the authenticated actor EmployeeId, never accepts employeeId, and returns the same PagedResult<ProductionEntryListItemDto> contract as the manager list. Add GET /api/production-entries/{id}. Query employee/order/operation/user display data in Application, not endpoint code. Distinguish a live record owned by another employee (403) from missing or soft-deleted (404). Do not expose deleted detail. Existing create/update/delete policies remain unchanged.

- [ ] Step 1: Write failing Application tests for /mine ownership, ignored employee override, detail DTO raw/display fields and soft-delete exclusion.
- [ ] Step 2: Write failing API tests for anonymous 401, Worker own history 200, Worker other entry 403, Manager/Admin detail 200, missing/deleted 404, unauthorized live detail 403 and fixed paged shape.
- [ ] Step 3: Run focused tests and confirm the expected failures.
- [ ] Step 4: Implement the read service/DTO and map the two endpoints without changing domain or persistence schema.
- [ ] Step 5: Run all backend tests including existing production entry tests.
- [ ] Step 6: Commit with feat: add production history and detail reads.

### Task 3: Admin read-only audit query

Files:

- Create src/backend/German.Application/Auditing/AuditLogListItemDto.cs
- Create src/backend/German.Application/Auditing/AuditLogListQuery.cs
- Create src/backend/German.Application/Auditing/AuditLogQueryService.cs
- Create src/backend/German.Api/Endpoints/AuditLogEndpoints.cs
- Modify src/backend/German.Api/Program.cs
- Test tests/German.Application.Tests/Auditing/AuditLogQueryServiceTests.cs
- Test tests/German.Api.Tests/AuditLogApiTests.cs

Interfaces:

    public sealed record AuditLogListQuery(
        DateOnly? FromDate,
        DateOnly? UntilDate,
        string? EntityType,
        Guid? EntityId,
        AuditAction? Action,
        Guid? PerformedByUserId,
        int? Page,
        int? PageSize);

    public sealed record AuditLogListItemDto(
        Guid Id,
        string EntityType,
        Guid EntityId,
        AuditAction Action,
        DateTimeOffset PerformedAt,
        Guid PerformedByUserId,
        string PerformedByUsername,
        string? PerformedByEmployeeCode,
        string? PerformedByEmployeeName,
        string? BeforeJson,
        string? AfterJson);

GET /api/audit-logs uses AdminOnly, the same page/pageSize validation and fixed paged response shape, and sort PerformedAt DESC, Id DESC. Apply all filters before count/pagination. Return before/after JSON to Admin because the route is AdminOnly. Do not add mutation or schema changes.

- [ ] Step 1: Write failing Application tests for filters, stable ordering, empty pages, page validation and performed-by display mapping.
- [ ] Step 2: Write failing API tests for anonymous 401, Worker/Manager 403 and Admin 200 with JSON fields.
- [ ] Step 3: Run the focused tests and verify red.
- [ ] Step 4: Implement query service, endpoint mapping, DI registration and AdminOnly policy usage.
- [ ] Step 5: Run backend and architecture tests.
- [ ] Step 6: Commit with feat: add admin audit read endpoint.

### Task 4: ERP tokens, feedback primitives and neutral shared components

Files:

- Modify src/frontend/src/styles.css
- Create src/frontend/src/components/erp/PageHeader.jsx
- Create src/frontend/src/components/erp/FilterBar.jsx
- Create src/frontend/src/components/erp/DataTable.jsx
- Create src/frontend/src/components/erp/StatusBadge.jsx
- Create src/frontend/src/components/erp/FormSection.jsx
- Create src/frontend/src/components/erp/Field.jsx
- Create src/frontend/src/components/erp/DetailPanel.jsx
- Create src/frontend/src/components/erp/ConfirmDialog.jsx
- Create src/frontend/src/components/erp/Alert.jsx
- Create src/frontend/src/components/erp/Toast.jsx
- Create src/frontend/src/components/erp/ToastProvider.jsx
- Create src/frontend/src/components/erp/InlineMessage.jsx
- Create src/frontend/src/components/erp/EmptyState.jsx
- Test src/frontend/src/components/erp/erpComponents.test.js

Interfaces:

    DataTable: columns, rows, loading, error, emptyMessage, density, rowKey, onRowClick, selectedRowKey
    Field: label, required, hint, error, children, htmlFor
    FilterBar: children, loading, onSubmit, onReset
    DetailPanel: open, title, onClose, children
    StatusBadge: variant, children

Add CSS tokens once: primary #1d4ed8, hover #1e40af, soft #eff6ff, bg #f3f4f6, surface #ffffff, border #d1d5db, text #111827, muted #6b7280, radius 4/6px, control 38px, row 42px, sidebar 240/64px. Use Tailwind utilities only for layout/responsive composition; use tokens for color/radius/control density. DataTable renders loading/error/empty states. StatusBadge has no business mapping. ConfirmDialog implements focus-on-open, focus return, Escape close when enabled, destructive action not default and loading-disabled actions. ToastProvider exposes app-level toast.success/error/info while feature state remains in features.

- [ ] Step 1: Write failing tests for semantic badge variants, table loading/error/empty rendering, Field errors, FilterBar submit/reset and feedback component contracts. Use react-dom/server for render smoke tests and pure helpers for focus/keyboard behavior; do not add a testing library.
- [ ] Step 2: Run frontend tests and confirm red.
- [ ] Step 3: Implement the minimal neutral primitives and token layer.
- [ ] Step 4: Run frontend tests and inspect generated build CSS for token usage.
- [ ] Step 5: Add architecture assertions that components/erp cannot import features, shared components do not contain business status/calculation mappings and frontend source contains no forbidden browser feedback calls.
- [ ] Step 6: Run architecture tests and commit with feat: add ERP frontend primitives.

### Task 5: Pathname router, role-aware shell and session states

Files:

- Create src/frontend/src/app/routes.js
- Create src/frontend/src/app/navigation.js
- Create src/frontend/src/app/session.js
- Create src/frontend/src/app/AppShell.jsx
- Create src/frontend/src/app/Sidebar.jsx
- Create src/frontend/src/app/Topbar.jsx
- Create src/frontend/src/app/Breadcrumbs.jsx
- Create src/frontend/src/app/AccessDeniedPage.jsx
- Create src/frontend/src/app/NotFoundPage.jsx
- Create src/frontend/src/app/SessionExpiredPage.jsx
- Modify src/frontend/src/app/App.jsx
- Modify src/frontend/src/main.jsx only if ToastProvider is mounted there
- Test src/frontend/src/app/routes.test.js
- Test src/frontend/src/app/navigation.test.js

Interfaces:

    matchRoute(pathname, routes) -> { route, params } | null
    getDefaultRoute(role) -> string
    navigate(pathname, options = {})
    subscribeToNavigation(listener)

Route matching is segment-based and distinguishes /orders/new from /orders/:id. routes.js is the single metadata source for path, roles, navLabel, breadcrumb and component. navigate(path, { presentation: "panel", backgroundRoute: "/production" }) updates history and React router state together. popstate restores pathname and history state. Direct detail loads without panel state render standalone detail. Shell owns only collapsed sidebar, navigation and session display. Worker defaults to /production/new; Manager/Admin default to /production; forbidden UX routes render AccessDeniedPage and unmatched routes render NotFoundPage.

- [ ] Step 1: Write failing pure route tests for static/parameter routes, segment matching, role default, role denial and breadcrumb params.
- [ ] Step 2: Write failing navigation tests for pushState state payload, listener notification, popstate handling and panel-vs-deep-link resolution.
- [ ] Step 3: Run focused tests and verify red.
- [ ] Step 4: Implement router/navigation and shell components using shared ERP primitives and role-aware route metadata.
- [ ] Step 5: Run frontend tests and build.
- [ ] Step 6: Commit with feat: add ERP shell and pathname navigation.

### Task 6: Server-paged Production List Report

Files:

- Create src/frontend/src/features/production-entries/ProductionEntryListPage.jsx
- Create src/frontend/src/features/production-entries/productionEntryQuery.js
- Delete src/frontend/src/features/production-entries/ProductionEntryTable.jsx after all consumers move
- Modify src/frontend/src/features/production-entries/productionEntryManagement.js
- Test src/frontend/src/features/production-entries/productionEntryQuery.test.js
- Test src/frontend/src/features/production-entries/ProductionEntryListPage.test.js

Interfaces:

    buildProductionEntryListQuery(filters) -> string
    normalizeProductionEntryListResponse(payload) -> PagedResult

Render PageHeader, FilterBar, compact DataTable, pagination and DetailPanel. Do not create record cards or a fake status column. Query the backend contract with date/filter/search/page/pageSize. Reset page to 1 when filters change. Display server totalCount/totalPages. Use employee/order/operation lookup endpoints only for filter options. Export calls the existing xlsx endpoint and uses shared Toast/Alert feedback. Row click calls navigate("/production/:id", { presentation: "panel", backgroundRoute: "/production" }) on desktop.

- [ ] Step 1: Write failing query builder tests for default page/pageSize, date/filter/search serialization, empty search and reset behavior.
- [ ] Step 2: Run focused frontend tests and verify red.
- [ ] Step 3: Implement query builder and List Report page.
- [ ] Step 4: Add tests for loading/error/empty table, page navigation, row selection and refresh after mutation callback.
- [ ] Step 5: Run frontend tests and build.
- [ ] Step 6: Commit with feat: add production list report.

### Task 7: Production detail, shared create/edit form and mutation synchronization

Files:

- Create src/frontend/src/features/production-entries/ProductionEntryDetailPage.jsx
- Create src/frontend/src/features/production-entries/ProductionEntryFormPage.jsx
- Create src/frontend/src/features/production-entries/productionEntryErrors.js
- Modify src/frontend/src/features/production-entries/ProductionEntryForm.jsx as the shared field/payload implementation used by the new page
- Modify src/frontend/src/features/production-entries/ProductionEntryPreview.jsx
- Modify src/frontend/src/features/production-entries/ManagerProductionEntryPage.jsx to become a thin employee-selection entry into the shared form, then delete it in Task 10 after route migration
- Test src/frontend/src/features/production-entries/productionEntryErrors.test.js
- Test src/frontend/src/features/production-entries/ProductionEntryFormPage.test.js
- Test src/frontend/src/features/production-entries/ProductionEntryDetailPage.test.js

Interfaces:

    ProductionEntryFormPage({ mode: "create" | "edit", session, entry, onSaved, onCancel })
    mapProductionEntryError(error) -> { scope, message, fieldErrors? }

Detail calls GET /api/production-entries/:id, renders the detail DTO and exposes edit/delete only to Manager/Admin. Desktop panel preserves list context; standalone detail is used on refresh/deep-link/mobile. Create/edit share FormSection, Field, preview and action bar; no modal. Worker form hides employee selector; Manager/Admin replacement flow selects employee. Preserve raw values across mode switching, submit only current-mode raw fields, and display server-calculated quantities as authoritative. A 409 renders the standard Alert and reload action; never auto-submit. Delete uses ConfirmDialog. Create/Edit/Delete refetch current list/detail query instead of patching rows manually. All user-visible feedback uses shared components.

- [ ] Step 1: Write failing form/detail tests for mode payloads, Worker field visibility, server result display, 409 reload flow, delete confirmation and no forbidden browser feedback calls.
- [ ] Step 2: Run focused frontend tests and verify red.
- [ ] Step 3: Implement shared create/edit form and standalone/panel detail presentation.
- [ ] Step 4: Run frontend tests and build.
- [ ] Step 5: Commit with feat: add production detail and ERP entry form.

### Task 8: Route-owned Employee, Order, Shift and Report pages

Files:

- Create src/frontend/src/features/employees/EmployeeListPage.jsx
- Create src/frontend/src/features/employees/EmployeeDetailPage.jsx
- Create src/frontend/src/features/employees/EmployeeFormPage.jsx
- Create src/frontend/src/features/production-orders/ProductionOrderListPage.jsx
- Create src/frontend/src/features/production-orders/ProductionOrderDetailPage.jsx
- Create src/frontend/src/features/production-orders/ProductionOrderFormPage.jsx
- Create src/frontend/src/features/shifts/ShiftListPage.jsx
- Create src/frontend/src/features/shifts/ShiftDetailPage.jsx
- Create src/frontend/src/features/shifts/ShiftFormPage.jsx
- Create src/frontend/src/features/shifts/ShiftAssignmentSection.jsx
- Create src/frontend/src/features/reports/ProductionReportPage.jsx
- Modify EmployeeSettingsPage.jsx and ProductionOrderPage.jsx only while migrating their existing API behavior into the new route-owned pages; delete both after Task 8 route migration is verified
- Test feature-specific Bun tests for loading/error/empty and primary action flows

Each feature calls only its own API functions or generic lib/api. Employee local search remains a documented local-search limitation for the existing API; do not copy it to ProductionEntry. Order operations remain a table inside detail; clone remains in the order form. Shift assignment is a detail/form section. Reports use the existing Excel endpoint and shared feedback. Mobile Manager/Admin keeps table density with deliberate horizontal scroll/sticky columns or full detail page.

- [ ] Step 1: Add failing route/page tests for each feature loading, error, empty and primary action state.
- [ ] Step 2: Run focused frontend tests and verify red.
- [ ] Step 3: Implement each feature page using shared primitives and route config.
- [ ] Step 4: Remove runtime imports of ManagerApp and old tab navigation.
- [ ] Step 5: Run frontend tests and build.
- [ ] Step 6: Commit with feat: migrate ERP feature pages.

### Task 9: Admin Accounts and Audit UI

Files:

- Create src/frontend/src/features/admin/UserAccountListPage.jsx
- Create src/frontend/src/features/admin/UserAccountFormPage.jsx
- Create src/frontend/src/features/admin/AuditLogListPage.jsx
- Create src/frontend/src/features/admin/auditQuery.js
- Test src/frontend/src/features/admin/auditQuery.test.js
- Test src/frontend/src/features/admin/adminPages.test.js

Interfaces:

    buildAuditLogQuery(filters) -> string

Accounts follow List → Form and existing admin account endpoints. Audit follows read-only List → Filter and calls /api/audit-logs with server pagination. Only Admin sees the route/menu; backend AdminOnly remains authoritative. Before/after JSON is shown in a neutral detail presentation using shared feedback.

- [ ] Step 1: Write failing query/page tests for audit filters, pagination, empty/error states and Admin-only navigation.
- [ ] Step 2: Run focused tests and verify red.
- [ ] Step 3: Implement account/audit pages.
- [ ] Step 4: Run frontend tests and build.
- [ ] Step 5: Commit with feat: add admin ERP pages.

### Task 10: Remove ManagerApp and complete architecture guardrails

Files:

- Modify src/frontend/src/architecture.test.js
- Modify src/frontend/src/app/App.jsx
- Delete src/frontend/src/features/manager/ManagerApp.jsx once no consumer remains
- Review all changed frontend feature files and src/backend/German.Api/Endpoints/*.cs

Guardrails:

- components/erp cannot import features.
- Feature A cannot import feature B internals.
- No feature imports ManagerApp.
- Shell/shared files contain no calculation/business status mapping.
- No alert(, window.alert, window.confirm or window.prompt in frontend source.
- Route metadata has required path/roles/breadcrumb/component fields.
- Backend endpoint modules contain no EF/DbContext/Application abstraction query access.
- API maps /mine before /{id} and maps /audit-logs with AdminOnly.

- [ ] Step 1: Write failing architecture tests for all listed dependency, route, feedback and endpoint-order invariants.
- [ ] Step 2: Run cd src/frontend && bun test and confirm red against pre-migration code.
- [ ] Step 3: Implement guardrail updates and remove the obsolete manager runtime path.
- [ ] Step 4: Run complete verification:

    dotnet restore German.sln
    dotnet build German.sln --no-restore --configuration Release
    dotnet test German.sln --configuration Release
    cd src/frontend
    bun install --frozen-lockfile
    bun test
    bun run build
    cd ../..
    bash -n deploy.sh
    bash tests/deploy-script.test.sh

- [ ] Step 5: Review git diff, scan for secrets and verify no schema/migration/domain/calculation changes.
- [ ] Step 6: Commit with chore: finalize ERP frontend redesign guardrails.

### Task 11: Publish reviewed documentation and deploy to integration

Files:

- Review docs/superpowers/specs/2026-08-12-erp-frontend-redesign-design.md
- Review docs/superpowers/plans/2026-08-12-erp-frontend-redesign.md

- [ ] Step 1: Ensure spec and plan commits contain documentation only before implementation begins.
- [ ] Step 2: Publish updated spec and plan to repository dev using the authorized GitHub path if local HTTPS credentials are unavailable.
- [ ] Step 3: After implementation commits are merged to dev, run ./deploy.sh update from a clean dev checkout.
- [ ] Step 4: Verify migration completes before app restart, health returns 200 and deployment logs contain no startup migration/seed behavior.
- [ ] Step 5: Hand off the integration URL and commit SHA for UI/UX review.

## Self-review checklist

- Backend paged manager list, Worker /mine, detail DTO/semantics and Admin audit read each have an implementation task.
- Shell/router/history state, shared tokens/feedback, list/detail/form, feature boundaries, responsive rules and guardrails each have an implementation task.
- No task changes Domain, ProductionCalculator, EF schema, migration, Excel export contract or mutation authorization.
- /mine cannot accept an employee override.
- /audit-logs is explicitly AdminOnly and read-only.
- page, pageSize, out-of-range page and fixed empty response are covered.
- ProductionEntryDetailDto contains every field needed by detail/edit UI.
- No TODO, TBD, vague error step or undefined neighboring interface remains.
