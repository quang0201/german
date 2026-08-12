# Docker + Excel Export Design

Ngày: 2026-08-12

## 1. Mục tiêu

Bổ sung hai khả năng cho MVP hiện tại mà không thay đổi kiến trúc đã khóa:

1. Chạy toàn bộ ứng dụng bằng Docker/Compose với một container ứng dụng duy nhất.
2. Xuất báo cáo sản lượng `.xlsx` cho `Manager` và `Admin` bằng `DocumentFormat.OpenXml`.

PostgreSQL tiếp tục là database remote. Docker Compose không tạo container PostgreSQL.

## 2. Ràng buộc kiến trúc

Giữ nguyên architecture contract hiện tại:

```text
German.Domain
    ↑
German.Application
    ↑              ↑
German.Infrastructure   German.Api
```

- `German.Api` tiếp tục dùng ASP.NET Core Minimal API.
- Endpoint chỉ nhận HTTP input, gọi Application service và map HTTP response.
- Không query EF Core trực tiếp trong endpoint.
- Excel implementation nằm ở `German.Infrastructure`.
- Application không reference Infrastructure.
- Không thay đổi business calculation hiện có.

## 3. Dependency mới đã được duyệt

Thêm NuGet package:

```text
DocumentFormat.OpenXml
```

Đây là dependency duy nhất mới cho tính năng Excel.

Không thêm ClosedXML, EPPlus, NPOI hoặc thư viện Excel khác.

## 4. Docker runtime

### 4.1 Mô hình chạy

```text
Docker host
└─ german-app :8080
   ├─ ASP.NET Core Minimal API
   ├─ React static frontend
   └─ kết nối PostgreSQL remote
```

Không có `german-db` service trong Compose.

### 4.2 Dockerfile multi-stage

Dockerfile gồm ba giai đoạn:

1. `frontend-build`
   - image Bun chính thức;
   - `bun install --frozen-lockfile`;
   - build React frontend.

2. `backend-build`
   - image .NET SDK chính thức;
   - restore solution;
   - publish `German.Api`;
   - copy frontend build output vào `German.Api/wwwroot` trước hoặc trong publish pipeline theo cấu trúc hiện tại.

3. `runtime`
   - image ASP.NET Core runtime chính thức;
   - chỉ chứa published output;
   - listen trên port `8080`;
   - không chứa SDK/Bun.

Mục tiêu là image runtime nhỏ và không mang tool build vào production container.

## 5. Docker Compose

`compose.yaml` chỉ có service:

```text
german-app
```

Thuộc tính chính:

- build từ `Dockerfile` ở repository root;
- map `${APP_PORT:-8080}:8080`;
- `restart: unless-stopped`;
- nạp biến môi trường từ `.env`;
- healthcheck gọi `/health`;
- không chứa password/database credential hard-code trong YAML.

Lệnh chạy chuẩn:

```bash
docker compose up -d --build
```

Lệnh xem log:

```bash
docker compose logs -f german-app
```

Lệnh dừng:

```bash
docker compose down
```

## 6. Cấu hình environment

Repo commit `.env.example`, không commit `.env` thật.

`.gitignore` phải chứa `.env`.

### `.env.example`

```text
APP_PORT=8080
ConnectionStrings__German=Host=db.example.com;Port=5432;Database=german;Username=german;Password=change-me;SSL Mode=Require
BootstrapAdmin__Enabled=false
BootstrapAdmin__Username=admin
BootstrapAdmin__Password=change-me
```

Người vận hành copy:

```bash
cp .env.example .env
```

rồi thay credential thật.

Không đưa password PostgreSQL hoặc bootstrap admin thật vào GitHub.

## 7. PostgreSQL remote

Ứng dụng dùng connection string từ:

```text
ConnectionStrings__German
```

EF Core migration tiếp tục được chạy khi API startup theo behavior hiện tại.

Nếu PostgreSQL remote không kết nối được hoặc migration thất bại:

- application startup thất bại;
- container restart theo policy Compose;
- lỗi xuất hiện trong container logs;
- không fallback sang database khác.

Remote PostgreSQL cần cho phép kết nối từ host chạy Docker và nên yêu cầu SSL nếu nhà cung cấp hỗ trợ.

## 8. Excel export — scope

### 8.1 Quyền

Chỉ:

- `Manager`
- `Admin`

được gọi export endpoint.

`Worker` nhận `403 Forbidden`.

Anonymous nhận `401 Unauthorized`.

### 8.2 Endpoint

Minimal API endpoint dự kiến:

```text
GET /api/reports/production/export.xlsx
```

Policy:

```text
ManagerOrAdmin
```

Query filter hỗ trợ:

```text
fromDate
untilDate
employeeId
orderId
operationId
```

Tất cả filter optional, nhưng server giới hạn khoảng ngày tối đa để tránh export không kiểm soát. MVP dùng giới hạn 366 ngày cho một request.

Nếu không truyền ngày, mặc định export ngày hiện tại.

`fromDate > untilDate` hoặc range vượt 366 ngày trả `400`.

## 9. Application layer cho report

Thêm module:

```text
German.Application/Reports
```

Các thành phần chính:

### `ProductionReportService`

Trách nhiệm:

- validate filter;
- query dữ liệu sản lượng qua `IGermanDbContext`;
- loại các record soft-deleted;
- join Employee, ProductionOrder, ProductionOperation;
- trả report rows độc lập với Excel/OpenXML.

### `ProductionReportRow`

Dữ liệu chuẩn:

- WorkDate
- EmployeeCode
- EmployeeName
- ProductionOrderCode
- ProductName
- OperationNumber
- OperationName
- Unit
- HcQuantity
- TcQuantity
- TotalQuantity
- OvertimeHours
- EntryMode
- Note

### `IProductionReportExporter`

Application định nghĩa abstraction:

```text
ExportProductionAsync(rows, metadata) -> byte[]/stream result
```

Application không biết OpenXML.

## 10. Infrastructure Excel exporter

Thêm:

```text
German.Infrastructure/Excel/OpenXmlProductionReportExporter
```

Implementation dùng `DocumentFormat.OpenXml`.

Workbook MVP có một sheet:

```text
Sản lượng
```

Các cột theo thứ tự:

1. Ngày
2. Mã NV
3. Họ tên
4. Mã SX
5. Sản phẩm
6. CĐ
7. Tên công đoạn
8. Đơn vị
9. HC
10. TC
11. Tổng
12. Giờ TC
13. Kiểu nhập
14. Ghi chú

Format tối thiểu:

- header bold;
- freeze dòng header;
- auto-filter;
- ngày hiển thị `dd/MM/yyyy`;
- quantity là numeric cell, không ghi dưới dạng text;
- overtime hours là numeric;
- độ rộng cột được đặt hợp lý;
- không merge cell trong bảng dữ liệu.

Không thêm formatting phức tạp trong MVP.

## 11. File response

Endpoint trả:

```text
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Tên file:

```text
san-luong_yyyyMMdd_yyyyMMdd.xlsx
```

Ví dụ:

```text
san-luong_20260801_20260812.xlsx
```

Nếu dữ liệu không có row phù hợp, vẫn trả file Excel hợp lệ chỉ có header. Không trả 404.

## 12. Data flow

```text
HTTP GET export.xlsx
        ↓
ReportEndpoints
        ↓
ProductionReportService
        ↓
IGermanDbContext
        ↓
ProductionReportRow[]
        ↓
IProductionReportExporter
        ↓
OpenXmlProductionReportExporter
        ↓
.xlsx bytes
        ↓
HTTP File response
```

Endpoint không phụ thuộc trực tiếp vào OpenXML hoặc DbContext.

## 13. Error handling

### 400

- invalid date range;
- date range > 366 ngày;
- filter input không hợp lệ.

### 401

- chưa đăng nhập.

### 403

- Worker gọi export.

### 500

- lỗi không mong đợi khi tạo workbook.

Không trả stack trace cho client.

## 14. Testing

### Application tests

- default range là ngày hiện tại;
- validate `fromDate <= untilDate`;
- reject > 366 ngày;
- soft-deleted entry không được export;
- filter employee/order/operation hoạt động đúng;
- row mapping đúng HC/TC/Total/Unit.

### Infrastructure/OpenXML tests

- tạo được workbook hợp lệ;
- workbook có sheet `Sản lượng`;
- header đúng thứ tự;
- numeric quantity được ghi numeric;
- empty rows vẫn tạo file hợp lệ.

### API integration tests

- anonymous export → 401;
- Worker export → 403;
- Manager export → 200 và đúng content type;
- Admin export → 200;
- invalid range → 400.

### Docker verification

CI hoặc verification step phải xác nhận:

```bash
docker build .
docker compose config
```

Nếu môi trường CI cho phép chạy container, thêm smoke test `/health`. Nếu không, build/config validation là tiêu chí bắt buộc tối thiểu.

## 15. CI

CI hiện tại tiếp tục build/test backend + frontend + architecture tests.

Bổ sung:

- Docker image build check;
- `docker compose config` check.

Không push image lên registry trong scope này.

## 16. Documentation

README bổ sung:

- cách tạo `.env`;
- cấu hình remote PostgreSQL;
- `docker compose up -d --build`;
- xem logs;
- update image sau khi pull code mới;
- endpoint export Excel và quyền Manager/Admin.

## 17. Không làm trong scope này

- PostgreSQL container/local database trong Compose;
- Docker development hot reload;
- Docker registry publishing;
- Kubernetes;
- reverse proxy Nginx/Traefik;
- HTTPS termination trong container;
- scheduled export;
- Excel nhiều sheet;
- pivot table/chart;
- import Excel;
- email report.

## 18. Tiêu chí hoàn thành

Tính năng hoàn thành khi:

1. `docker compose up -d --build` chạy được app với PostgreSQL remote chỉ bằng `.env`.
2. `.env` thật không được commit.
3. `/health` dùng được cho container healthcheck.
4. ASP.NET Core serve cả Minimal API và React production build trong cùng container.
5. Manager/Admin export `.xlsx` được.
6. Worker bị 403 khi export.
7. Excel chứa đúng dữ liệu filter và không chứa soft-deleted rows.
8. OpenXML nằm ở Infrastructure, không phá dependency direction.
9. Backend/frontend/architecture tests tiếp tục pass.
10. Docker build và Compose config validation pass.
