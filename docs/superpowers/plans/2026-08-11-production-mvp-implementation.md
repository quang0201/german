# Production MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng MVP quản lý sản lượng với backend .NET 10 + EF Core/PostgreSQL và frontend React + Bun + Tailwind, hỗ trợ 3 chế độ nhập HC/TC, phân quyền Admin/Manager/Worker, bộ ca theo ngày hiệu lực, mã sản xuất có công đoạn riêng, soft delete và audit log.

**Architecture:** Monorepo modular monolith. Backend chia Domain/Application/Infrastructure/Api; business rules nằm ở Domain/Application, EF Core chỉ nằm ở Infrastructure, HTTP chỉ nằm ở Api. Frontend React không dùng UI/state/router library bên thứ ba; routing tối thiểu dùng History API và state React chuẩn.

**Tech Stack:** .NET 10 LTS, ASP.NET Core 10, EF Core 10, PostgreSQL + Npgsql.EntityFrameworkCore.PostgreSQL 10.x, React 19.2.x, Bun 1.3.x, Tailwind CSS 4.3.x.

## Global Constraints

- Không thêm thư viện bên thứ ba ngoài Npgsql đã được duyệt.
- Package Microsoft chính thức được phép dùng.
- Frontend dùng React + Bun + Tailwind; không dùng Vite, React Router, Redux, Zustand, Axios, component library hoặc form library.
- Backend không dùng MediatR, AutoMapper, FluentValidation hoặc framework CQRS.
- Không hard-code 8 giờ HC; tổng giờ HC lấy từ ShiftTemplate hiệu lực của nhân viên.
- ProductionOperation luôn thuộc ProductionOrder.
- Worker chỉ submit, không update/delete.
- Manager/Admin được update và soft delete ProductionEntry; các thao tác này phải ghi AuditLog.
- Mọi calculation quan trọng phải có unit test trước khi implement.

---

## File map

```text
german/
├─ German.sln
├─ Directory.Build.props
├─ README.md
├─ src/backend/
│  ├─ German.Domain/
│  │  ├─ German.Domain.csproj
│  │  ├─ Common/Entity.cs
│  │  ├─ Auth/UserRole.cs
│  │  ├─ Employees/Employee.cs
│  │  ├─ Shifts/ShiftTemplate.cs
│  │  ├─ Shifts/ShiftPeriod.cs
│  │  ├─ Shifts/EmployeeShiftAssignment.cs
│  │  ├─ Production/ProductionOrderStatus.cs
│  │  ├─ Production/ProductionOrder.cs
│  │  ├─ Production/ProductionOperation.cs
│  │  ├─ Production/ProductionEntryMode.cs
│  │  ├─ Production/ProductionEntry.cs
│  │  ├─ Production/ProductionCalculationInput.cs
│  │  ├─ Production/ProductionCalculationResult.cs
│  │  └─ Production/ProductionCalculator.cs
│  ├─ German.Application/
│  │  ├─ German.Application.csproj
│  │  ├─ Abstractions/IGermanDbContext.cs
│  │  ├─ Common/AppResult.cs
│  │  ├─ ProductionEntries/CreateProductionEntryCommand.cs
│  │  ├─ ProductionEntries/ProductionEntryService.cs
│  │  └─ ProductionEntries/ProductionEntryDto.cs
│  ├─ German.Infrastructure/
│  │  ├─ German.Infrastructure.csproj
│  │  ├─ Persistence/GermanDbContext.cs
│  │  ├─ Persistence/Configurations/*.cs
│  │  └─ DependencyInjection.cs
│  └─ German.Api/
│     ├─ German.Api.csproj
│     ├─ Program.cs
│     ├─ appsettings.json
│     ├─ Contracts/ProductionEntries/*.cs
│     └─ Endpoints/ProductionEntryEndpoints.cs
├─ src/frontend/
│  ├─ package.json
│  ├─ index.html
│  ├─ src/main.jsx
│  ├─ src/styles.css
│  ├─ src/app/App.jsx
│  ├─ src/lib/api.js
│  └─ src/features/production-entries/ProductionEntryForm.jsx
└─ tests/
   ├─ German.Domain.Tests/
   │  ├─ German.Domain.Tests.csproj
   │  └─ Production/ProductionCalculatorTests.cs
   └─ German.Application.Tests/
      ├─ German.Application.Tests.csproj
      └─ ProductionEntries/ProductionEntryServiceTests.cs
```

---

### Task 1: Scaffold solution and dependency boundaries

**Files:**
- Create: `German.sln`
- Create: `Directory.Build.props`
- Create: `src/backend/German.Domain/German.Domain.csproj`
- Create: `src/backend/German.Application/German.Application.csproj`
- Create: `src/backend/German.Infrastructure/German.Infrastructure.csproj`
- Create: `src/backend/German.Api/German.Api.csproj`
- Create: `tests/German.Domain.Tests/German.Domain.Tests.csproj`
- Create: `tests/German.Application.Tests/German.Application.Tests.csproj`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Produces four backend projects with references `Application -> Domain`, `Infrastructure -> Application + Domain`, `Api -> Application + Infrastructure`, and test projects referencing only layers they test.

- [ ] **Step 1: Create project files with .NET 10 target**

Use `net10.0`, nullable reference types, implicit usings, warnings as errors for project code.

- [ ] **Step 2: Add only approved package references**

Infrastructure:

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0">
  <PrivateAssets>all</PrivateAssets>
  <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
</PackageReference>
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.2" />
```

Tests use Microsoft MSTest packages only.

- [ ] **Step 3: Add solution project references**

Run when SDK is available:

```bash
dotnet sln German.sln add src/backend/German.Domain/German.Domain.csproj
dotnet sln German.sln add src/backend/German.Application/German.Application.csproj
dotnet sln German.sln add src/backend/German.Infrastructure/German.Infrastructure.csproj
dotnet sln German.sln add src/backend/German.Api/German.Api.csproj
dotnet sln German.sln add tests/German.Domain.Tests/German.Domain.Tests.csproj
dotnet sln German.sln add tests/German.Application.Tests/German.Application.Tests.csproj
```

- [ ] **Step 4: Verify dependency graph**

Run:

```bash
dotnet restore German.sln
dotnet build German.sln --no-restore
```

Expected: build succeeds with no warning/error.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold german monorepo"
```

---

### Task 2: Implement production calculation engine with TDD

**Files:**
- Create: `src/backend/German.Domain/Production/ProductionEntryMode.cs`
- Create: `src/backend/German.Domain/Production/ProductionCalculationInput.cs`
- Create: `src/backend/German.Domain/Production/ProductionCalculationResult.cs`
- Create: `src/backend/German.Domain/Production/ProductionCalculator.cs`
- Create: `tests/German.Domain.Tests/Production/ProductionCalculatorTests.cs`

**Interfaces:**
- Produces:

```csharp
public enum ProductionEntryMode { ByShift, Direct, TotalWithOvertime }

public sealed record ProductionCalculationInput(
    ProductionEntryMode Mode,
    decimal HcHours,
    decimal? Shift1Quantity = null,
    decimal? Shift2Quantity = null,
    decimal? DirectHcQuantity = null,
    decimal? DirectTcQuantity = null,
    decimal? TotalQuantity = null,
    decimal? OvertimeHours = null,
    decimal? OvertimeQuantity = null);

public sealed record ProductionCalculationResult(decimal Hc, decimal Tc, decimal Total);

public static class ProductionCalculator
{
    public static ProductionCalculationResult Calculate(ProductionCalculationInput input);
}
```

- [ ] **Step 1: Write failing tests for Mode ByShift**

Tests:
- `Ca1=280, Ca2=120, no OT -> HC=400, TC=0, Total=400`.
- `HC hours=9, Ca1+Ca2=430, OT=2 -> TC=96` because `430/9*2 = 95.555...` rounded midpoint away from zero.
- If `OvertimeQuantity=108`, use 108 instead of auto-calculate.

- [ ] **Step 2: Run tests and confirm failure**

```bash
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --filter ProductionCalculatorTests
```

Expected: FAIL because calculator types do not exist.

- [ ] **Step 3: Implement ByShift minimally**

Use:

```csharp
private static decimal RoundQuantity(decimal value) =>
    decimal.Round(value, 0, MidpointRounding.AwayFromZero);
```

Reject negative quantities/hours with `ArgumentOutOfRangeException`.

- [ ] **Step 4: Add failing tests for Direct mode**

`DirectHC=535, DirectTC=135 -> 535/135/670`, and verify values are not reallocated.

- [ ] **Step 5: Implement Direct mode**

Use input values directly and default missing TC to zero.

- [ ] **Step 6: Add failing tests for TotalWithOvertime**

Cases:
- `Total=620, H=8, OT=1.5 -> HC=522, TC=98`.
- `Total=400, OT absent -> HC=400, TC=0`.
- `H=0 with OT > 0 -> validation exception`.

- [ ] **Step 7: Implement TotalWithOvertime**

Formula:

```csharp
hc = RoundQuantity(total * hcHours / (hcHours + overtimeHours));
tc = total - hc;
```

- [ ] **Step 8: Run domain tests**

```bash
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/backend/German.Domain tests/German.Domain.Tests
git commit -m "feat: add production calculation engine"
```

---

### Task 3: Add domain entities for employees, shifts and production

**Files:**
- Create: `src/backend/German.Domain/Common/Entity.cs`
- Create: `src/backend/German.Domain/Auth/UserRole.cs`
- Create: `src/backend/German.Domain/Auth/UserAccount.cs`
- Create: `src/backend/German.Domain/Employees/Employee.cs`
- Create: `src/backend/German.Domain/Shifts/ShiftTemplate.cs`
- Create: `src/backend/German.Domain/Shifts/ShiftPeriod.cs`
- Create: `src/backend/German.Domain/Shifts/EmployeeShiftAssignment.cs`
- Create: `src/backend/German.Domain/Production/ProductionOrderStatus.cs`
- Create: `src/backend/German.Domain/Production/ProductionOrder.cs`
- Create: `src/backend/German.Domain/Production/ProductionOperation.cs`
- Create: `src/backend/German.Domain/Production/ProductionEntry.cs`
- Create: `src/backend/German.Domain/Auditing/AuditLog.cs`

**Interfaces:**
- Entity IDs use `Guid`.
- Quantities use `decimal`.
- Dates use `DateOnly`; time-of-day uses `TimeOnly`.
- Audit timestamps use UTC `DateTimeOffset`.

- [ ] **Step 1: Add base entity and enums**

```csharp
public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
}
```

Roles: `Admin`, `Manager`, `Worker`.

- [ ] **Step 2: Add Employee/Shift entities**

`ShiftTemplate.TotalHours` is not persisted; Application calculates it from periods to preserve interval semantics.

- [ ] **Step 3: Add ProductionOrder and ProductionOperation**

Order has Code, ProductName, PlannedQuantity, Status, optional StartDate/EndDate.

- [ ] **Step 4: Add ProductionEntry**

Persist both raw mode-specific fields and calculated `HcQuantity`, `TcQuantity`, `TotalQuantity`, plus work time, submitter, soft-delete fields and concurrency `Version` integer.

- [ ] **Step 5: Add AuditLog**

Store `BeforeJson` and `AfterJson` as strings; PostgreSQL configuration will map to `jsonb`.

- [ ] **Step 6: Build domain tests**

```bash
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/backend/German.Domain
git commit -m "feat: add production domain model"
```

---

### Task 4: Add EF Core PostgreSQL persistence

**Files:**
- Create: `src/backend/German.Application/Abstractions/IGermanDbContext.cs`
- Create: `src/backend/German.Infrastructure/Persistence/GermanDbContext.cs`
- Create: `src/backend/German.Infrastructure/Persistence/Configurations/*.cs`
- Create: `src/backend/German.Infrastructure/DependencyInjection.cs`

**Interfaces:**

```csharp
public interface IGermanDbContext
{
    DbSet<Employee> Employees { get; }
    DbSet<UserAccount> UserAccounts { get; }
    DbSet<ShiftTemplate> ShiftTemplates { get; }
    DbSet<ShiftPeriod> ShiftPeriods { get; }
    DbSet<EmployeeShiftAssignment> EmployeeShiftAssignments { get; }
    DbSet<ProductionOrder> ProductionOrders { get; }
    DbSet<ProductionOperation> ProductionOperations { get; }
    DbSet<ProductionEntry> ProductionEntries { get; }
    DbSet<AuditLog> AuditLogs { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

- [ ] **Step 1: Define DbContext abstraction in Application**

Application references EF Core abstractions through official Microsoft package transitively available from Infrastructure boundary; if compile requires explicit package, add `Microsoft.EntityFrameworkCore` 10.0.0 to Application because it is Microsoft-official.

- [ ] **Step 2: Implement GermanDbContext**

Use explicit configurations via `ApplyConfigurationsFromAssembly`.

- [ ] **Step 3: Configure constraints**

Required unique indexes:
- `UserAccount.Username`.
- `Employee.EmployeeCode`.
- `ProductionOrder.Code`.
- `(ProductionOrderId, OperationNumber)`.

Configure quantities as `numeric(18,2)`.

- [ ] **Step 4: Configure soft-delete query filter for ProductionEntry**

```csharp
builder.HasQueryFilter(x => !x.IsDeleted);
```

Provide application methods that can use `IgnoreQueryFilters()` only for audit/admin restore scenarios later.

- [ ] **Step 5: Register Npgsql**

```csharp
services.AddDbContext<GermanDbContext>(options =>
    options.UseNpgsql(configuration.GetConnectionString("German")));
services.AddScoped<IGermanDbContext>(sp => sp.GetRequiredService<GermanDbContext>());
```

- [ ] **Step 6: Build solution**

```bash
dotnet build German.sln
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/backend/German.Application src/backend/German.Infrastructure
git commit -m "feat: add postgresql persistence"
```

---

### Task 5: Implement ProductionEntry application service with authorization, shift resolution and audit

**Files:**
- Create: `src/backend/German.Application/Common/AppResult.cs`
- Create: `src/backend/German.Application/Common/CurrentActor.cs`
- Create: `src/backend/German.Application/ProductionEntries/CreateProductionEntryCommand.cs`
- Create: `src/backend/German.Application/ProductionEntries/UpdateProductionEntryCommand.cs`
- Create: `src/backend/German.Application/ProductionEntries/ProductionEntryDto.cs`
- Create: `src/backend/German.Application/ProductionEntries/ProductionEntryService.cs`
- Create: `tests/German.Application.Tests/ProductionEntries/ProductionEntryServiceTests.cs`

**Interfaces:**

```csharp
public sealed record CurrentActor(Guid UserId, UserRole Role, Guid? EmployeeId);

public sealed class ProductionEntryService
{
    Task<AppResult<ProductionEntryDto>> CreateAsync(CurrentActor actor, CreateProductionEntryCommand command, CancellationToken ct);
    Task<AppResult<ProductionEntryDto>> UpdateAsync(CurrentActor actor, Guid entryId, int expectedVersion, UpdateProductionEntryCommand command, CancellationToken ct);
    Task<AppResult> DeleteAsync(CurrentActor actor, Guid entryId, int expectedVersion, CancellationToken ct);
}
```

- [ ] **Step 1: Write failing Worker ownership test**

Worker with `EmployeeId=A` submits command for B -> result code `production_entry.forbidden_employee`.

- [ ] **Step 2: Implement ownership rule**

Manager/Admin bypass ownership; Worker must match own EmployeeId.

- [ ] **Step 3: Write failing order/operation tests**

Worker can submit only InProduction order; operation must belong to chosen order.

- [ ] **Step 4: Implement order/operation validation**

Return stable codes, never throw for expected validation.

- [ ] **Step 5: Write failing shift effective-date test**

For auto-calculate mode, resolve EmployeeShiftAssignment where `EffectiveFrom <= WorkDate` and `EffectiveTo == null || EffectiveTo >= WorkDate`, sum ShiftPeriod durations, and pass hours to calculator.

- [ ] **Step 6: Implement shift resolution and calculation**

If no valid shift and auto-calc needs hours, return `production_entry.invalid_shift`.

- [ ] **Step 7: Write failing update/delete authorization tests**

Worker update/delete -> forbidden. Manager update -> new values and audit. Manager delete -> `IsDeleted=true`, audit action Delete.

- [ ] **Step 8: Implement audit serialization using `System.Text.Json`**

No third-party serializer.

- [ ] **Step 9: Implement optimistic version check**

If `Version != expectedVersion`, return conflict `production_entry.version_conflict`; increment version on successful update/delete.

- [ ] **Step 10: Run application tests**

```bash
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/backend/German.Application tests/German.Application.Tests
git commit -m "feat: add production entry application service"
```

---

### Task 6: Expose minimal API endpoints

**Files:**
- Create: `src/backend/German.Api/Program.cs`
- Create: `src/backend/German.Api/appsettings.json`
- Create: `src/backend/German.Api/Contracts/ProductionEntries/CreateProductionEntryRequest.cs`
- Create: `src/backend/German.Api/Contracts/ProductionEntries/UpdateProductionEntryRequest.cs`
- Create: `src/backend/German.Api/Endpoints/ProductionEntryEndpoints.cs`
- Create: `src/backend/German.Api/Endpoints/LookupEndpoints.cs`

**Interfaces:**

Endpoints:

```text
POST   /api/production-entries
PUT    /api/production-entries/{id}
DELETE /api/production-entries/{id}
GET    /api/production-entries?date=&employeeId=&orderId=&operationId=
GET    /api/lookups/production-orders/active
GET    /api/production-orders/{id}/operations
```

- [ ] **Step 1: Configure dependency injection and JSON**

Use `System.Text.Json`, camelCase, enum string serialization.

- [ ] **Step 2: Add request mapping**

Do not expose EF entities.

- [ ] **Step 3: Add centralized AppResult-to-HTTP mapping**

400 validation, 403 forbidden, 404 not found, 409 conflict.

- [ ] **Step 4: Add development CORS only**

Allow frontend dev origin from configuration; production should serve through same trusted origin/reverse proxy.

- [ ] **Step 5: Build API**

```bash
dotnet build src/backend/German.Api/German.Api.csproj
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/backend/German.Api
git commit -m "feat: expose production entry api"
```

---

### Task 7: Add internal authentication with username-or-employee-code login

**Files:**
- Create: `src/backend/German.Application/Auth/AuthService.cs`
- Create: `src/backend/German.Infrastructure/Auth/PasswordService.cs`
- Modify: `src/backend/German.Api/Program.cs`
- Create: `src/backend/German.Api/Endpoints/AuthEndpoints.cs`

**Interfaces:**

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

- [ ] **Step 1: Use official Microsoft password hasher**

Use `Microsoft.AspNetCore.Identity.PasswordHasher<UserAccount>`; no custom password crypto.

- [ ] **Step 2: Login lookup**

Search exact normalized Username first; if absent search Employee.EmployeeCode linked to UserAccount.

- [ ] **Step 3: Configure ASP.NET Core cookie authentication**

Use HttpOnly, Secure in production, SameSite=Lax or Strict according to final deployment topology. No third-party token library.

- [ ] **Step 4: Create claims**

Claims: user id, role, optional employee id.

- [ ] **Step 5: Add authorization policies**

`AdminOnly`, `ManagerOrAdmin`, `AuthenticatedWorker`.

- [ ] **Step 6: Protect ProductionEntry endpoints**

Create: authenticated; Update/Delete: ManagerOrAdmin.

- [ ] **Step 7: Build and test auth service**

```bash
dotnet test German.sln
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/backend tests
git commit -m "feat: add internal authentication"
```

---

### Task 8: Add frontend shell and production entry mobile form

**Files:**
- Create: `src/frontend/package.json`
- Create: `src/frontend/index.html`
- Create: `src/frontend/src/main.jsx`
- Create: `src/frontend/src/styles.css`
- Create: `src/frontend/src/app/App.jsx`
- Create: `src/frontend/src/lib/api.js`
- Create: `src/frontend/src/features/auth/LoginPage.jsx`
- Create: `src/frontend/src/features/production-entries/ProductionEntryForm.jsx`
- Create: `src/frontend/src/features/production-entries/ProductionEntryPreview.jsx`

**Interfaces:**
- Frontend uses native `fetch` with `credentials: "include"`.
- No Axios/router/state library.
- App switches minimal routes using `window.location.pathname` and History API.

- [ ] **Step 1: Add approved frontend dependencies only**

```json
{
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "tailwindcss": "4.3.0",
    "@tailwindcss/cli": "4.3.0"
  },
  "packageManager": "bun@1.3.14"
}
```

- [ ] **Step 2: Configure Tailwind**

`src/styles.css` begins with:

```css
@import "tailwindcss";
```

- [ ] **Step 3: Implement login form**

One identifier field labeled `Tên đăng nhập hoặc mã nhân viên`, password field, submit to `/api/auth/login`.

- [ ] **Step 4: Implement production entry form with 3 modes**

Mode labels:
- `Theo ca`
- `HC / TC trực tiếp`
- `Tổng + giờ tăng ca`

Common fields: ngày, mã sản xuất, công đoạn, optional giờ bắt đầu/kết thúc, ghi chú.

- [ ] **Step 5: Preview calculation before submit**

Frontend may mirror formula for UX, but backend result displayed after submit is authoritative.

- [ ] **Step 6: Mobile-first layout**

Use Tailwind only; no UI component library. Inputs minimum touch height 44px.

- [ ] **Step 7: Verify frontend**

```bash
cd src/frontend
bun install
bunx @tailwindcss/cli -i ./src/styles.css -o ./src/tailwind.css
bun build ./index.html --outdir ./dist --production
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/frontend
git commit -m "feat: add mobile production entry frontend"
```

---

### Task 9: Add manager CRUD screens and lookup APIs

**Files:**
- Create: `src/frontend/src/features/employees/EmployeePage.jsx`
- Create: `src/frontend/src/features/shifts/ShiftTemplatePage.jsx`
- Create: `src/frontend/src/features/production-orders/ProductionOrderPage.jsx`
- Create: `src/frontend/src/features/production-entries/ProductionEntryTable.jsx`
- Create: backend endpoints/services for employee, shift, order and operation CRUD.

**Interfaces:**
- ProductionOrder create supports `create new operations` or `clone operations from sourceOrderId`.
- Unit is free text.
- Manager/Admin production table supports filter + edit + soft delete.

- [ ] **Step 1: Add employee and shift CRUD**

Manager/Admin can create Employee, ShiftTemplate, ShiftPeriods and effective-date assignments.

- [ ] **Step 2: Add order CRUD and clone operation transaction**

Clone copies `OperationNumber`, `Name`, `Unit`, `SortOrder`, `IsActive`; new IDs and new ProductionOrderId.

- [ ] **Step 3: Add manager production table API**

Support date/employee/order/operation filters and return calculated HC/TC/Total.

- [ ] **Step 4: Build manager pages with native React state**

No third-party data grid; semantic table on desktop and cards on narrow screens.

- [ ] **Step 5: Verify full build**

```bash
dotnet test German.sln
cd src/frontend && bun run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add manager production administration"
```

---

### Task 10: Add seed, migration, README and CI verification

**Files:**
- Create: initial EF migration under `src/backend/German.Infrastructure/Persistence/Migrations/`
- Modify: `README.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- README documents PostgreSQL connection string and local start commands.
- Seed creates one Admin only when explicitly enabled by development configuration; no production default password.

- [ ] **Step 1: Generate initial migration**

```bash
dotnet ef migrations add InitialCreate --project src/backend/German.Infrastructure --startup-project src/backend/German.Api
```

- [ ] **Step 2: Document environment configuration**

Connection string key: `ConnectionStrings__German`.

- [ ] **Step 3: Add CI using official GitHub/Microsoft tooling**

CI must run backend restore/build/test. Frontend uses official Bun install script or preinstalled Bun strategy without adding application libraries.

- [ ] **Step 4: Run complete verification locally where toolchains are available**

```bash
dotnet restore German.sln
dotnet build German.sln --no-restore
dotnet test German.sln --no-build
cd src/frontend
bun install --frozen-lockfile
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: finalize production mvp foundation"
```

---

## Self-review

- Spec coverage: auth, roles, employees, shift templates, effective-date assignments, production orders, per-order operations, 3 calculation modes, multi-order/day, work-time context, soft delete, audit, clone operations, mobile worker UI and manager UI are mapped to Tasks 2-10.
- Dependency policy: no unapproved application library is introduced. Npgsql is the only approved non-Microsoft backend dependency; frontend has only React/Tailwind packages.
- No hard-coded 8-hour assumption in the calculation engine.
- All later signatures reference names defined earlier in the plan.
- No `TODO`/`TBD` placeholders are required for execution.
