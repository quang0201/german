# German Production MVP — Thiết kế hệ thống

Ngày: 2026-08-11

## 1. Mục tiêu

Xây dựng MVP quản lý sản lượng cho môi trường sản xuất có nhiều mã sản xuất, mỗi mã có bộ công đoạn riêng, công nhân có thể làm nhiều công đoạn và nhiều mã trong cùng ngày, và dữ liệu HC/TC có nhiều cách nhập khác nhau.

MVP tập trung vào nhập, chuẩn hóa, quản lý và tổng hợp sản lượng. Chưa triển khai tính lương, chấm công, AI đọc Zalo hoặc workflow duyệt nhiều cấp.

## 2. Stack công nghệ đã chốt

### Backend
- .NET / ASP.NET Core.
- Entity Framework Core.
- PostgreSQL.
- Npgsql.EntityFrameworkCore.PostgreSQL.

### Frontend
- React.
- Bun.
- Tailwind CSS.

### Quy tắc thư viện
Chỉ dùng thư viện chính thức của .NET/React/Tailwind và các thư viện đã được duyệt ở trên. Không thêm thư viện bên thứ ba mới nếu chưa được người dùng cho phép.

## 3. Kiến trúc tổng thể

Áp dụng modular monolith với layered architecture.

```text
german/
├─ src/
│  ├─ backend/
│  │  ├─ German.Api/
│  │  ├─ German.Application/
│  │  ├─ German.Domain/
│  │  └─ German.Infrastructure/
│  │
│  └─ frontend/
│     ├─ src/
│     │  ├─ features/
│     │  ├─ components/
│     │  ├─ pages/
│     │  ├─ services/
│     │  └─ styles/
│     └─ package.json
│
├─ tests/
│  ├─ German.Domain.Tests/
│  └─ German.Application.Tests/
│
├─ docs/
└─ German.sln
```

### Trách nhiệm từng layer

#### German.Domain
- Entity và value object cốt lõi.
- Enum nghiệp vụ.
- Quy tắc tính sản lượng thuần, không phụ thuộc database hoặc HTTP.

#### German.Application
- Use case/application service.
- Authorization theo vai trò ở mức nghiệp vụ.
- DTO nội bộ.
- Validation nghiệp vụ.
- Điều phối calculation engine.

#### German.Infrastructure
- EF Core DbContext.
- Mapping entity PostgreSQL.
- Repository/data access implementation khi cần.
- Password hashing sử dụng API chính thức của .NET.
- Audit persistence.

#### German.Api
- HTTP endpoints.
- Authentication/authorization middleware.
- Request/response mapping.
- Global error handling.

### Frontend
Frontend chia theo feature thay vì chia thuần theo loại file. Các feature đầu tiên:
- auth
- employees
- shift-templates
- production-orders
- operations
- production-entries
- audit

## 4. Module MVP

1. Auth
2. Employees
3. ShiftTemplates
4. EmployeeShiftAssignments
5. ProductionOrders
6. ProductionOperations
7. ProductionEntries
8. AuditLogs

## 5. Vai trò và quyền

### Admin
- Toàn quyền hệ thống.
- Quản lý tài khoản, nhân viên, bộ ca, mã sản xuất, công đoạn và sản lượng.

### Quản lý
- Xem toàn bộ sản lượng.
- Nhập thay công nhân.
- Chỉnh sửa sản lượng.
- Xóa mềm sản lượng.
- Xem audit log liên quan tới thao tác sản lượng.

### Công nhân
- Đăng nhập bằng tài khoản cá nhân.
- Chỉ nộp sản lượng của chính mình.
- Sau khi nộp không được sửa hoặc xóa.
- Chỉ nhìn thấy các mã sản xuất đang ở trạng thái `Đang sản xuất`.

## 6. Đăng nhập

Màn hình đăng nhập dùng một ô định danh duy nhất:

`Tên đăng nhập hoặc Mã nhân viên`

Backend tìm theo Username trước, nếu không có thì tìm theo EmployeeCode.

Cả `Username` và `EmployeeCode` phải unique.

### UserAccount
- Id
- Username
- PasswordHash
- Role
- IsActive
- EmployeeId nullable
- CreatedAt
- UpdatedAt

### Employee
- Id
- EmployeeCode
- FullName
- IsActive
- CreatedAt
- UpdatedAt

Công nhân/quản lý có thể gắn 1-1 với Employee. Admin hệ thống có thể không cần Employee.

## 7. Bộ ca HC

Hệ thống không hard-code 8 giờ/ngày.

Admin/Quản lý tạo nhiều bộ ca HC trong Settings. Ví dụ:

```text
Bộ ca A
- Ca 1: 07:00 -> 11:30
- Ca 2: 12:30 -> 17:00
```

Hệ thống chỉ cộng thời lượng các khoảng được cấu hình. Không suy luận giờ nghỉ trưa hoặc quy định lao động khác.

### ShiftTemplate
- Id
- Name
- IsActive
- CreatedAt
- UpdatedAt

### ShiftPeriod
- Id
- ShiftTemplateId
- Name
- StartTime
- EndTime
- SortOrder

Tất cả ShiftPeriod trong MVP là HC. TC không cấu hình cố định trong Settings.

## 8. Gán bộ ca cho công nhân

Mỗi công nhân được gán một bộ ca theo ngày hiệu lực để thay đổi ca trong tương lai không làm sai dữ liệu lịch sử.

### EmployeeShiftAssignment
- Id
- EmployeeId
- ShiftTemplateId
- EffectiveFrom
- EffectiveTo nullable

Quy tắc:
- Tại một thời điểm chỉ có một assignment hiệu lực cho một Employee.
- Khi đổi ca, assignment cũ được đóng `EffectiveTo`, assignment mới bắt đầu từ ngày hiệu lực mới.
- Khi tính một ProductionEntry, hệ thống lấy ShiftTemplate hiệu lực tại ngày sản lượng.

## 9. Mã sản xuất

Mỗi mã sản xuất có bộ công đoạn riêng, không dùng danh mục công đoạn toàn cục cố định.

### ProductionOrder
- Id
- Code, unique
- ProductName
- PlannedQuantity
- Status
- StartDate nullable
- EndDate nullable
- CreatedAt
- UpdatedAt

### ProductionOrderStatus
- Draft
- InProduction
- Completed
- Cancelled

Công nhân chỉ được chọn order `InProduction` khi nộp sản lượng.

## 10. Công đoạn

Công đoạn thuộc trực tiếp một ProductionOrder.

### ProductionOperation
- Id
- ProductionOrderId
- OperationNumber
- Name
- Unit
- SortOrder
- IsActive
- CreatedAt
- UpdatedAt

`Unit` là text tự do do quản lý nhập, ví dụ `cái`, `túi`, `thùng`, `bộ`.

Ràng buộc:
- `(ProductionOrderId, OperationNumber)` unique.
- Một mã sản xuất có thể có số lượng công đoạn bất kỳ.
- CĐ11 của mã A không liên quan CĐ11 của mã B.

### Sao chép công đoạn
Frontend khi tạo mã sản xuất có hai lựa chọn:
- Tạo công đoạn mới hoàn toàn.
- Sao chép từ mã sản xuất cũ.

Backend clone các ProductionOperation thành bản ghi mới thuộc order mới. Sau clone, chỉnh sửa order mới không ảnh hưởng order nguồn.

## 11. ProductionEntry — dữ liệu lõi

Một công nhân có thể:
- làm nhiều công đoạn trong cùng ngày;
- cùng một công đoạn có nhiều công nhân;
- làm nhiều mã sản xuất trong cùng ngày.

Không có quan hệ cố định `Employee -> Operation`.

### ProductionEntry
- Id
- WorkDate
- EmployeeId
- ProductionOrderId
- ProductionOperationId
- EntryMode
- Shift1Quantity nullable
- Shift2Quantity nullable
- DirectHcQuantity nullable
- DirectTcQuantity nullable
- TotalInputQuantity nullable
- OvertimeHours nullable
- OvertimeQuantity nullable
- WorkStart nullable
- WorkEnd nullable
- CalculatedHcQuantity
- CalculatedTcQuantity
- CalculatedTotalQuantity
- Note nullable
- SubmittedByUserId
- CreatedAt
- UpdatedAt
- IsDeleted
- DeletedAt nullable
- DeletedByUserId nullable

Số lượng dùng decimal để không khóa hệ thống vào đơn vị nguyên, vì có trường hợp thùng chia lẻ hoặc đơn vị khác trong tương lai.

## 12. Ba chế độ nhập sản lượng

### Mode A — Theo ca
Người dùng nhập:
- Ca 1 quantity
- Ca 2 quantity
- TC hours hoặc TC quantity nếu có

Quy tắc:

```text
HC = Ca1 + Ca2
```

Nếu không khai báo TC:

```text
TC = 0
Total = HC
```

Nếu có `OvertimeQuantity`, ưu tiên số thực tế:

```text
TC = OvertimeQuantity
Total = HC + TC
```

Nếu chỉ có `OvertimeHours`, tự tính theo năng suất HC của tổng giờ HC cấu hình cho công nhân tại ngày đó.

Gọi:
- H = tổng số giờ HC trong ShiftTemplate hiệu lực.
- Qhc = Ca1 + Ca2.
- Hot = giờ TC khai báo.

```text
TC = round(Qhc / H * Hot)
Total = Qhc + TC
```

Không hard-code H = 8.

Nếu H = 0 thì không được auto-calculate; API trả validation error và yêu cầu quản lý sửa cấu hình ca hoặc nhập HC/TC trực tiếp.

### Mode B — HC/TC trực tiếp
Người dùng nhập:
- HC thực tế
- TC thực tế
- giờ TC optional

Quy tắc:

```text
CalculatedHC = DirectHC
CalculatedTC = DirectTC
CalculatedTotal = DirectHC + DirectTC
```

Không tự tính lại.

Mode này dùng để xử lý các trường hợp đặc biệt, nhiều mã trong ngày hoặc người quản lý đã tự phân bổ sản lượng.

### Mode C — Tổng sản lượng + giờ TC
Người dùng nhập:
- TotalQuantity
- OvertimeHours

Gọi:
- H = tổng giờ HC cấu hình.
- Hot = giờ TC.
- Qt = tổng sản lượng.

```text
HC = round(Qt * H / (H + Hot))
TC = Qt - HC
```

Nếu không có TC hours:

```text
HC = Qt
TC = 0
```

Nếu H = 0 hoặc H + Hot <= 0, API trả validation error.

## 13. Làm nhiều mã trong cùng ngày

Trường hợp một công nhân làm nhiều mã trong ngày được hỗ trợ bằng nhiều ProductionEntry.

Ví dụ:

```text
07:00-12:00 | Mã A | CĐ3 | ...
13:00-17:00 | Mã B | CĐ7 | ...
17:30-20:00 | Mã B | CĐ7 | ...
```

`WorkStart` và `WorkEnd` là optional nhưng được khuyến nghị khi người đó làm nhiều mã/công đoạn trong cùng ngày.

Trong MVP:
- thời gian này dùng để lưu bối cảnh và validation;
- có thể cảnh báo các entry của cùng nhân viên bị chồng thời gian;
- không tự phân bổ sản lượng giữa nhiều mã chỉ dựa vào giờ;
- quản lý có thể dùng Mode B để nhập HC/TC thủ công cho trường hợp đặc biệt.

TC là dữ liệu thực tế theo ngày/entry do người nhập khai báo số giờ hoặc khoảng thời gian. Không có ca TC cố định trong Settings.

## 14. Trường hợp nhiều người cùng làm một công đoạn

Không có chức năng tự chia sản lượng làm chung trong MVP.

Người nhập tự tính và tạo từng ProductionEntry riêng cho từng nhân viên.

Ví dụ 17 thùng của hai người, quản lý tự quyết định:

```text
Nương | CĐ20 | 9
Quân   | CĐ20 | 8
```

Hệ thống không tự chia 8.5/8.5.

## 15. Soft delete và audit log

ProductionEntry không xóa vật lý qua UI/API thông thường.

Khi Quản lý/Admin xóa:
- `IsDeleted = true`
- lưu DeletedAt
- lưu DeletedByUserId
- entry không xuất hiện trong báo cáo mặc định.

Mọi thay đổi ProductionEntry của Quản lý/Admin phải ghi AuditLog.

### AuditLog
- Id
- EntityType
- EntityId
- Action (`Create`, `Update`, `Delete`)
- PerformedByUserId
- PerformedAt
- BeforeJson nullable
- AfterJson nullable

Audit log ưu tiên tính truy vết, không dùng để tính báo cáo.

## 16. Validation nghiệp vụ

Các validation chính:
- ProductionOrder phải tồn tại.
- ProductionOperation phải thuộc đúng ProductionOrder.
- Công nhân chỉ nộp cho EmployeeId của chính mình.
- Quản lý/Admin có thể nhập thay.
- Công nhân chỉ được nộp vào ProductionOrder đang `InProduction`.
- Quantity không âm.
- OvertimeHours không âm.
- StartTime phải nhỏ hơn EndTime nếu cùng ngày.
- ShiftTemplate hiệu lực phải tồn tại nếu mode cần auto-calculate.
- Công nhân không được update/delete entry đã nộp.
- Quản lý/Admin được update/delete mềm.

Validation chồng thời gian:
- MVP trả cảnh báo cho quản lý/công nhân nếu entry mới chồng thời gian với entry khác của cùng người/cùng ngày.
- Không block lưu trong MVP vì dữ liệu thực tế có thể có nhiều công đoạn song song trong một khoảng báo cáo.

## 17. API conventions

REST JSON dưới prefix `/api`.

Nhóm endpoint dự kiến:

```text
/api/auth
/api/employees
/api/shift-templates
/api/employee-shift-assignments
/api/production-orders
/api/production-orders/{id}/operations
/api/production-entries
/api/audit-logs
```

Không expose EF entity trực tiếp. API dùng request/response model riêng.

Response lỗi dùng cấu trúc thống nhất:

```json
{
  "code": "production_entry.invalid_shift",
  "message": "Không có bộ ca HC hiệu lực cho nhân viên tại ngày đã chọn.",
  "errors": {}
}
```

## 18. Authentication và authorization

MVP dùng tài khoản nội bộ và mật khẩu.

Password không bao giờ lưu plaintext.

Sử dụng API hashing chính thức từ .NET/Microsoft; không thêm thư viện hashing bên thứ ba.

Authorization theo role:
- Admin
- Manager
- Worker

Endpoint sản lượng phải kiểm tra cả role và ownership, không chỉ ẩn nút ở frontend.

## 19. Frontend UX

### Công nhân — mobile first
Mục tiêu: nộp sản lượng nhanh trên điện thoại.

Luồng:
1. Đăng nhập.
2. Chọn ngày.
3. Chọn mã sản xuất đang chạy.
4. Chọn công đoạn.
5. Chọn chế độ nhập.
6. Nhập số liệu.
7. Xem kết quả HC/TC được tính trước khi nộp.
8. Nộp.

Sau khi nộp, công nhân chỉ xem entry của mình và không có nút sửa/xóa.

### Quản lý — desktop oriented nhưng responsive
- Danh sách sản lượng theo ngày.
- Filter nhân viên, mã SX, công đoạn.
- Nhập thay.
- Sửa.
- Xóa mềm.
- Quản lý mã sản xuất/công đoạn.
- Quản lý nhân viên/bộ ca.

### Tạo mã sản xuất
Form gồm:
- Code
- ProductName
- PlannedQuantity
- StartDate/EndDate optional
- Cách tạo công đoạn: mới hoặc clone từ mã cũ

## 20. Báo cáo MVP

MVP cần API và màn hình tổng hợp tối thiểu theo:
- ngày;
- nhân viên;
- mã sản xuất;
- công đoạn;
- HC;
- TC;
- tổng sản lượng.

Chưa yêu cầu tính lương.

Export Excel có thể là milestone sau của cùng sản phẩm, không phải blocking cho lõi nhập sản lượng.

## 21. Error handling

### Backend
- Global exception handler.
- Domain/application validation trả HTTP 400 với error code ổn định.
- Unauthorized = 401.
- Forbidden = 403.
- Not found = 404.
- Conflict như duplicate ProductionOrder Code = 409.
- Lỗi không mong đợi = 500, không trả stack trace cho client.

### Frontend
- Hiển thị validation cạnh field.
- Hiển thị lỗi server bằng message rõ ràng.
- Disable submit khi request đang chạy để tránh submit lặp.
- Sau khi submit thành công, hiển thị bản ghi đã chuẩn hóa HC/TC.

## 22. Concurrency và dữ liệu

ProductionEntry nên có concurrency token/version để tránh quản lý A ghi đè thay đổi của quản lý B mà không biết.

Khi update gặp version cũ, API trả 409 và yêu cầu tải lại dữ liệu.

## 23. Testing

### Domain tests
Tập trung vào Calculation Engine:
- Mode A không TC.
- Mode A có TC hours.
- Mode A có TC quantity thực tế.
- Mode B trực tiếp.
- Mode C có TC hours.
- Mode C không TC.
- ShiftTemplate không phải 8 giờ.
- Rounding.
- H = 0.
- Quantity/TC âm.

### Application tests
- Worker chỉ submit cho bản thân.
- Worker không update/delete.
- Manager được nhập thay/sửa/xóa mềm.
- Operation phải thuộc order.
- Order phải InProduction với Worker.
- Shift assignment theo ngày hiệu lực.
- Audit được tạo khi manager update/delete.

### API integration tests
Tối thiểu cho auth và production entry critical path sau khi scaffold database test phù hợp.

## 24. Quy tắc làm tròn

MVP dùng làm tròn sản lượng tự tính về số nguyên gần nhất, midpoint away from zero.

Giá trị gốc người dùng nhập ở Mode B không bị làm tròn ngoài precision database đã định nghĩa.

Nếu sau này từng công đoạn có quy tắc làm tròn khác, đó là extension ngoài MVP.

## 25. Phạm vi không làm trong MVP

- Tính lương.
- Chấm công.
- AI parse Zalo.
- Import trực tiếp từ Zalo.
- Workflow duyệt nhiều cấp.
- Tổ trưởng role.
- Tự chia sản lượng làm chung.
- Microservices.
- Realtime/websocket.
- App native mobile.
- Thư viện UI bên thứ ba.
- State-management library bên thứ ba.

## 26. Quyết định kiến trúc dài hạn

1. Không hard-code số công đoạn hoặc tên công đoạn toàn hệ thống.
2. Công đoạn luôn thuộc mã sản xuất.
3. Không hard-code 8 giờ HC.
4. HC duration lấy từ ShiftTemplate hiệu lực của nhân viên.
5. ProductionEntry là nguồn dữ liệu chuẩn cho báo cáo.
6. Người dùng có thể chọn auto-calculate hoặc direct HC/TC tùy trường hợp.
7. Một nhân viên có thể làm nhiều mã và nhiều công đoạn cùng ngày.
8. Mọi thay đổi dữ liệu quan trọng của quản lý được audit.
9. Xóa sản lượng là soft delete.
10. Backend giữ business rules; frontend không được là nguồn sự thật duy nhất của calculation.
11. Kiến trúc monorepo và modular monolith được giữ xuyên suốt MVP.

## 27. Tiêu chí hoàn thành MVP

MVP được coi là đạt khi:
- Admin tạo được user/employee.
- Admin tạo được ShiftTemplate và gán cho employee theo ngày hiệu lực.
- Quản lý tạo ProductionOrder.
- Quản lý tạo hoặc clone operations cho ProductionOrder.
- Worker đăng nhập được bằng username hoặc employee code.
- Worker nộp được ProductionEntry bằng cả 3 mode.
- Calculation HC/TC dùng đúng ShiftTemplate hiệu lực, không hard-code 8h.
- Worker không thể sửa/xóa entry đã nộp.
- Manager sửa và xóa mềm được entry.
- Update/delete của manager có AuditLog.
- Một người có thể có nhiều entry cho nhiều mã/công đoạn trong cùng ngày.
- Quản lý xem được bảng tổng hợp sản lượng theo ngày/người/mã/CĐ.
- Backend và frontend build/test thành công bằng stack và dependency đã được duyệt.
