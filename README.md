# German Production

MVP nhập và quản lý sản lượng sản xuất. Backend dùng .NET 10 + EF Core + PostgreSQL; frontend dùng React + Bun + Tailwind CSS.

## Chức năng hiện có

- Đăng nhập bằng tên đăng nhập hoặc mã nhân viên.
- Vai trò `Admin`, `Manager`, `Worker`.
- Worker chỉ nộp sản lượng của chính mình.
- Manager/Admin xem, sửa HC/TC, xóa mềm sản lượng và nhập thay công nhân.
- Ba chế độ nhập: Theo ca, HC/TC trực tiếp, Tổng + giờ tăng ca.
- HC được tính theo bộ ca hiệu lực của nhân viên; không hard-code 8 giờ.
- Quản lý nhân viên, bộ ca, lịch gán ca theo ngày hiệu lực.
- Mỗi mã sản xuất có công đoạn riêng và có thể clone công đoạn từ mã cũ.
- Admin tạo tài khoản nội bộ.
- Audit log khi Manager/Admin sửa hoặc xóa sản lượng.
- Manager/Admin xuất báo cáo sản lượng `.xlsx` bằng OpenXML.
- Có Docker/Compose production runtime một container app, kết nối PostgreSQL remote.

## Chạy bằng Docker Compose

Docker Compose không chạy PostgreSQL local. PostgreSQL phải là server remote có thể truy cập từ máy chạy Docker.

Tạo file cấu hình:

```bash
cp .env.example .env
```

Sửa `.env` với connection string thật, ví dụ:

```text
APP_PORT=8080
ConnectionStrings__German=Host=db.example.com;Port=5432;Database=german;Username=german;Password=your-password;SSL Mode=Require
BootstrapAdmin__Enabled=false
BootstrapAdmin__Username=admin
BootstrapAdmin__Password=change-this-password
```

Không commit `.env`. Repo chỉ lưu `.env.example`.

Build và chạy:

```bash
docker compose up -d --build
```

Xem log:

```bash
docker compose logs -f german-app
```

Dừng app:

```bash
docker compose down
```

Mặc định app được publish tại port `8080`. Có thể thay bằng `APP_PORT` trong `.env`.

Container chạy ASP.NET Core Minimal API và React static frontend trong cùng process/application origin. `/health` được dùng làm Docker healthcheck.

Khi API khởi động, EF Core tự áp dụng migration còn thiếu. Nếu PostgreSQL remote không kết nối được hoặc migration thất bại, startup sẽ thất bại và Compose sẽ restart container theo policy `unless-stopped`.

## PostgreSQL remote

Biến cấu hình bắt buộc:

```text
ConnectionStrings__German
```

Server PostgreSQL cần cho phép kết nối từ Docker host. Nên bật SSL/TLS theo cấu hình của nhà cung cấp database.

## Tạo Admin đầu tiên

Bootstrap chỉ tạo Admin khi database chưa có tài khoản nào và `BootstrapAdmin__Enabled=true`. Không có mật khẩu production mặc định trong code.

```text
BootstrapAdmin__Enabled=true
BootstrapAdmin__Username=admin
BootstrapAdmin__Password=change-this-password
```

Sau khi tạo tài khoản đầu tiên, nên đặt lại:

```text
BootstrapAdmin__Enabled=false
```

## Xuất Excel sản lượng

Endpoint Minimal API:

```text
GET /api/reports/production/export.xlsx
```

Chỉ `Manager` và `Admin` được phép gọi. Worker nhận `403 Forbidden`; chưa đăng nhập nhận `401 Unauthorized`.

Query parameters đều optional:

```text
fromDate=2026-08-01
untilDate=2026-08-12
employeeId=<guid>
orderId=<guid>
operationId=<guid>
```

Ví dụ:

```text
/api/reports/production/export.xlsx?fromDate=2026-08-01&untilDate=2026-08-12
```

Khoảng export tối đa là 366 ngày. Nếu không truyền ngày, hệ thống export ngày UTC hiện tại. File trả về có dạng:

```text
san-luong_20260801_20260812.xlsx
```

File gồm ngày, nhân viên, mã sản xuất, sản phẩm, công đoạn, đơn vị, HC, TC, tổng, giờ TC, kiểu nhập và ghi chú. Bản ghi đã soft-delete không được xuất.

## Chạy không dùng Docker

Yêu cầu môi trường:

- .NET SDK 10.x
- PostgreSQL
- Bun 1.3.14

Thiết lập connection string:

```bash
export ConnectionStrings__German='Host=db.example.com;Port=5432;Database=german;Username=german;Password=your-password;SSL Mode=Require'
```

Build frontend vào `German.Api/wwwroot` rồi chạy API:

```bash
cd src/frontend
bun install --frozen-lockfile
bun run build:api
cd ../backend/German.Api
dotnet run
```

## Chạy test

Backend:

```bash
dotnet restore German.sln
dotnet build German.sln --no-restore --configuration Release
dotnet test tests/German.Domain.Tests/German.Domain.Tests.csproj --no-build --configuration Release
dotnet test tests/German.Application.Tests/German.Application.Tests.csproj --no-build --configuration Release
dotnet test tests/German.Infrastructure.Tests/German.Infrastructure.Tests.csproj --no-build --configuration Release
dotnet test tests/German.Api.Tests/German.Api.Tests.csproj --no-build --configuration Release
```

Frontend + architecture guardrails:

```bash
cd src/frontend
bun install --frozen-lockfile
bun test
bun run build
```

Docker validation:

```bash
cp .env.example .env
docker compose config
docker build -t german:local .
```

## Tạo / cập nhật migration thủ công

`dotnet-ef` là tool chính thức của Microsoft:

```bash
dotnet tool install --global dotnet-ef --version 10.0.10
dotnet ef migrations add <MigrationName> \
  --project src/backend/German.Infrastructure \
  --startup-project src/backend/German.Api \
  --output-dir Persistence/Migrations
```

Cập nhật database thủ công:

```bash
dotnet ef database update \
  --project src/backend/German.Infrastructure \
  --startup-project src/backend/German.Api
```

## Kiến trúc

```text
German.Domain          business entities + calculation engine
German.Application     use cases, authorization rules, validation, application queries/report abstractions
German.Infrastructure  EF Core/PostgreSQL, password hashing, bootstrap, OpenXML exporter
German.Api             Minimal API/auth/composition/static frontend host
src/frontend           React worker + manager/admin UI theo feature
```

Architecture contract bắt buộc nằm tại [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). CI có architecture tests để chặn dependency đi ngược tầng, endpoint truy cập persistence trực tiếp và OpenXML rò khỏi Infrastructure.

## Branch workflow

```text
main  <- stable/release
dev   <- integration
feat/*, fix/*, review/* -> dev -> main
```

Tính năng mới tách từ `dev`; không phát triển trực tiếp trên `main`. `dev` là nhánh integration để review trước khi đưa vào `main`.

Thiết kế chi tiết nằm trong `docs/superpowers/specs/` và implementation plan trong `docs/superpowers/plans/`.
