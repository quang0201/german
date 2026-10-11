# Sản phẩm làm khuôn mẫu công đoạn và báo cáo nhiều mã SX: Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm Sản phẩm (khuôn mẫu CĐ) liên kết với Mã SX, lệnh gán dữ liệu cũ, và báo cáo cộng gộp nhiều mã theo số CĐ.

**Architecture:** Thêm bảng `Products` và `ProductOperationTemplates` cùng cột `ProductionOrders.ProductId` (nullable); mã SX vẫn giữ `ProductName` và CĐ riêng (lưu cả hai). Dịch vụ `ProductService`, endpoint `/api/products`, chế độ chạy `backfill-products`. Frontend thêm trang Sản phẩm, chọn sản phẩm khi tạo mã SX, và gộp báo cáo bằng hàm thuần túy phía trình duyệt.

**Tech Stack:** .NET 10, EF Core + PostgreSQL (test dùng InMemory), MSTest; React 19 + Bun test.

**Spec:** `docs/superpowers/specs/2026-10-11-product-template-design.md`

## Global Constraints

- Không xóa hay đổi nghĩa cột đang có; `ProductionOrders.ProductId` nullable; sản lượng (`ProductionEntries`) không bị đụng tới.
- Quyền: mọi endpoint sản phẩm dùng policy `ManagerOrAdmin`.
- Mã sản phẩm không trùng, so sánh không phân biệt hoa thường (`Code.ToUpper()` như mã SX).
- Backfill mặc định chỉ xem trước; chỉ ghi khi có cờ `--apply`; chạy lại không tạo trùng.
- Số gốc của mã: cụm số đứng riêng đầu tiên từ 3 chữ số trở lên (`(?<![\p{L}\p{N}])\d{3,}(?![\p{L}\p{N}])`); không có thì mã đứng riêng.
- Chữ ký CĐ = tập (`OperationNumber`, `Name` chuẩn hóa, `Unit` chuẩn hóa); đơn giá không dùng để gom.
- Báo cáo nhiều mã tối đa 8 mã, gọi API tổng hợp hiện có (không đổi backend báo cáo); Xuất Excel tắt khi chọn nhiều mã.
- Văn bản giao diện bằng tiếng Việt; không dùng dữ liệu giả trong sản phẩm.

## Review Focus

- Mã SX có hai cụm số (`4004 ... 3000`): lấy cụm đầu tiên.
- Hai mã cùng số gốc nhưng khác danh sách CĐ: không gom, báo là "bị bỏ sót" trong xem trước.
- Chạy backfill hai lần: lần hai không tạo sản phẩm hay gắn lại.
- Tạo mã SX có `productId` và đồng thời gửi danh sách CĐ: dùng danh sách gửi lên, không ghi đè bằng mẫu.
- Báo cáo nhiều mã khi một mã không có CĐ nào / một mã có CĐ trùng số trong cùng mã không xảy ra, mã thiếu CĐ chỉ vắng ở dòng đó.

---

### Task 1: Thực thể, cấu hình EF và migration

**Files:**
- Create: `src/backend/German.Domain/Production/Product.cs`, `src/backend/German.Domain/Production/ProductOperationTemplate.cs`
- Modify: `src/backend/German.Domain/Production/ProductionOrder.cs` (thêm `ProductId`), `src/backend/German.Application/Abstractions/IGermanDbContext.cs`, `src/backend/German.Infrastructure/Persistence/GermanDbContext.cs`
- Create: migration `AddProducts` (`dotnet ef migrations add`)
- Test: `tests/German.Infrastructure.Tests` hoặc `tests/German.Application.Tests/Products/ProductModelTests.cs`

**Interfaces:**
- Produces: `Product { Guid Id; string Code; string Name; bool IsActive; DateTimeOffset CreatedAt, UpdatedAt; List<ProductOperationTemplate> Operations }`; `ProductOperationTemplate { Guid Id; Guid ProductId; int OperationNumber; string Name; string Unit; decimal? FixedPrice; int SortOrder; bool IsActive }`; `ProductionOrder.ProductId : Guid?`; `IGermanDbContext.Products`, `.ProductOperationTemplates`.

- [ ] Viết test thất bại: thêm sản phẩm kèm 2 CĐ mẫu rồi đọc lại qua InMemory (kiểm tra `Products` và `ProductOperationTemplates` có trong context) và test mã trùng không phân biệt hoa thường ở tầng dịch vụ (Task 2).
- [ ] Chạy test, thấy lỗi biên dịch (chưa có thực thể).
- [ ] Viết thực thể, cấu hình: `Code` HasMaxLength(100) unique, `Name` 250, template `Name` 300, `Unit` 50, `FixedPrice` precision (18,2), index duy nhất (`ProductId`,`OperationNumber`), FK `ProductionOrder.ProductId` -> `Products` `OnDelete(SetNull)`.
- [ ] `dotnet ef migrations add AddProducts` (project Infrastructure, startup Api); kiểm tra migration chỉ tạo 2 bảng và 1 cột nullable.
- [ ] Chạy test, commit.

### Task 2: ProductService, API sản phẩm và gắn vào mã SX

**Files:**
- Create: `German.Application/Products/ProductDto.cs`, `ProductService.cs`; `German.Api/Contracts/Products/ProductRequests.cs`; `German.Api/Endpoints/ProductEndpoints.cs`
- Modify: `German.Api/Program.cs` (đăng ký `ProductService`, `MapProductEndpoints`); `German.Application/ProductionOrders/ProductionOrderDto.cs` (thêm `ProductId`, `ProductCode` vào `ProductionOrderDto`, `Guid? ProductId` vào `CreateProductionOrderCommand`/`UpdateProductionOrderCommand`); `ProductionOrderService.cs`; `German.Api/Contracts/ProductionOrders/ProductionOrderRequests.cs`; `ProductionOrderAdminEndpoints.cs`
- Test: `tests/German.Application.Tests/Products/ProductServiceTests.cs`, `tests/German.Application.Tests/ProductionOrders/ProductionOrderProductTests.cs`, `tests/German.Api.Tests/ProductApiTests.cs`

**Interfaces:**
- Produces: `ProductService.ListAsync(ct): IReadOnlyList<ProductSummaryDto>`; `GetAsync(Guid, ct): AppResult<ProductDto>`; `CreateAsync(SaveProductCommand, ct)`; `UpdateAsync(Guid, SaveProductCommand, ct)`; `DisableAsync(Guid, ct)`. `SaveProductCommand(string Code, string Name, bool IsActive, IReadOnlyList<ProductOperationInput> Operations)`. `ProductDto(Guid Id, string Code, string Name, bool IsActive, IReadOnlyList<ProductOperationDto> Operations, int OrderCount)`.
- Lỗi: `product.duplicate_code` (409), `product.duplicate_operation_number`, `product.not_found` (404), `product.invalid`.
- `ProductionOrderService.CreateAsync`: nếu `ProductId` có giá trị và không có `Operations`/`CloneFromOrderId` thì sao chép CĐ mẫu (bỏ CĐ không hoạt động); nếu `Operations` được gửi thì dùng danh sách đó. `UpdateAsync` chỉ đổi `ProductId` (kiểm tra tồn tại), không động tới CĐ.

- [ ] Test thất bại: tạo sản phẩm có 3 CĐ; mã trùng khác hoa thường bị từ chối; số CĐ trùng bị từ chối; tắt sản phẩm; tạo mã SX chọn sản phẩm nhận đúng 3 CĐ; tạo mã SX vừa có `productId` vừa gửi CĐ giữ danh sách gửi; gán `productId` cho mã đã có không đổi CĐ; gán sản phẩm không tồn tại -> lỗi; API 401/403 khi không đủ quyền.
- [ ] Chạy test, thấy thất bại.
- [ ] Cài đặt `ProductService` (kiểm tra như `ProductionOrderService.ValidateOperations`), endpoint (theo mẫu `ProductionOrderAdminEndpoints`), cập nhật dịch vụ mã SX và DTO.
- [ ] Chạy test, commit.

### Task 3: Backfill gán sản phẩm cho mã SX cũ

**Files:**
- Create: `German.Application/Products/ProductBackfillService.cs`, `German.Application/Products/ProductCodeKey.cs` (hàm số gốc)
- Modify: `German.Api/Startup/StartMode.cs` (thêm `BackfillProducts`), `German.Api/Program.cs` (nhánh `BackfillProducts`, đọc cờ `--apply`), `deploy.sh` (lệnh `backfill`)
- Test: `tests/German.Application.Tests/Products/ProductBackfillServiceTests.cs`, `tests/German.Api.Tests/StartModeTests.cs`

**Interfaces:**
- Produces: `ProductCodeKey.BaseOf(string orderCode): string`; `ProductBackfillService.PlanAsync(ct): BackfillPlan`; `ApplyAsync(BackfillPlan, ct): int`. `BackfillPlan { IReadOnlyList<PlannedProduct> Products; IReadOnlyList<SkippedOrder> Skipped; IReadOnlyList<PriceDifference> PriceDifferences }`.

- [ ] Test thất bại: ba mã `4004 xanh`, `4004 đen` (cùng CĐ 1,2,5) và `TÚI 4004 đỏ` (CĐ 8,9) -> một sản phẩm `4004` gồm xanh, đen; đỏ trong `Skipped` với lý do; xem trước không ghi gì (đếm `Products` = 0); `ApplyAsync` hai lần không tạo trùng; mã có hai cụm số lấy cụm đầu; giá khác nhau xuất hiện trong `PriceDifferences` nhưng vẫn gom; mã đã có `ProductId` được bỏ qua.
- [ ] Chạy test, thấy thất bại.
- [ ] Cài đặt gom theo (`BaseOf`, chữ ký CĐ), nhóm từ 2 mã trở lên mới tạo sản phẩm; `Name` = tên chung ngắn nhất; CĐ mẫu theo mã đầu theo thứ tự mã.
- [ ] Thêm chế độ khởi động, in kế hoạch ra console (xem trước) và chỉ ghi khi `--apply`; `StartModeTests` thêm trường hợp `backfill-products`.
- [ ] Chạy test, commit.

### Task 4: Frontend: trang Sản phẩm, tạo mã SX chọn sản phẩm, chi tiết mã

**Files:**
- Create: `src/frontend/src/features/products/ProductListPage.jsx`, `ProductDialog.jsx`, `productForm.js` (+ tests `productForm.test.js`)
- Modify: `app/routes.js`, `app/Sidebar.jsx` (nhóm Danh mục, mục "Sản phẩm"), `features/production-orders/ProductionOrderDialog.jsx` và `ProductionOrderListPage.jsx` (ô Sản phẩm, sao chép CĐ mẫu vào bản nháp), `productionOrderForm.js`
- Test: `productForm.test.js`, `routes.test.js`, `ProductionOrderDialog.test.js`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/products`, `productId`/`productCode` trên mã SX (Task 2).
- Produces: `buildProductPayload(form)`; `operationsFromTemplate(product)` trả danh sách CĐ cho bản nháp mã SX; `templateMismatch(order, product)` trả mô tả khác biệt (thiếu, thừa, khác tên).

- [ ] Test thất bại cho `buildProductPayload`, `operationsFromTemplate`, `templateMismatch`, và route `/products` chỉ cho Manager/Admin.
- [ ] Cài đặt hàm thuần, trang danh sách (ô tìm kiếm, bộ đếm theo `ListToolbar`), hộp thoại thêm/sửa có bảng CĐ mẫu (theo mẫu `ProductionOperationDialog`), mục menu, ô Sản phẩm trong hộp thoại mã SX và nút "Gán sản phẩm" + cảnh báo khác khuôn mẫu ở chi tiết mã.
- [ ] Chạy `bun test`, commit.

### Task 5: Báo cáo nhiều mã cộng gộp theo số CĐ

**Files:**
- Create: `features/reports/productionOperationMerge.js` (+ test), `features/reports/OrderMultiSelect.jsx`
- Modify: `features/reports/ReportPage.jsx`, `ProductionOperationSummaryChart.jsx`
- Test: `productionOperationMerge.test.js`, `ReportPage.test.js`

**Interfaces:**
- Produces: `mergeOperationSummaries(summaries, orders): { operations: [{ operationNumber, name, extraNames: string[], unit, hc, tc, total, external, combinedTotal, byOrder: [{ orderId, orderCode, hc, tc, total, external, combinedTotal }] }], plannedQuantity }`; `groupOrdersByProduct(orders): [{ key, label, orderIds }]`; `parseOrderParam(text): string[]`; `buildOrderParam(ids): string`.

- [ ] Test thất bại: hợp số CĐ của 3 mã (1,2,5 / 1,2,5 / 8,9 cho ra 1,2,5,8,9); tổng đúng; tên khác sinh `extraNames`; kế hoạch cộng dồn; `parseOrderParam("a,b")` và `"a"`; tối đa 8 mã.
- [ ] Chạy test, thấy thất bại.
- [ ] Cài đặt hàm gộp, bộ chọn nhiều mã theo nhóm sản phẩm, `ReportPage` gọi song song và vẽ dòng gộp có "Xem chi tiết" theo mã, tắt Xuất Excel khi chọn nhiều mã, đọc ghi `?order=id1,id2`.
- [ ] Chạy `bun test`, commit.

### Task 6: Kiểm tra tổng và đưa lên

- [ ] `dotnet test German.sln` và `bun test` đều pass.
- [ ] Build Docker local; chạy `migrations`, chạy `backfill-products` xem trước rồi `--apply` trên dữ liệu mẫu 4004; kiểm tra trên trình duyệt: trang Sản phẩm, tạo mã SX chọn sản phẩm, báo cáo chọn nhóm 4004.
- [ ] Push `dev`; báo cách chạy `./deploy.sh update` rồi `./deploy.sh backfill`.
