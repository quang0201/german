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
- Docker runtime một container app, kết nối PostgreSQL ngoài Compose.

## Deploy trên Linux

Cách khuyến nghị là dùng helper `deploy.sh`. PostgreSQL không được tạo bởi `compose.yaml`; database có thể ở cùng máy Linux hoặc ở một IP/domain khác.

Deploy lần đầu:

```bash
./deploy.sh setup
./deploy.sh migrate
./deploy.sh seed      # chỉ khi BootstrapAdmin__Enabled=true
./deploy.sh deploy
```

Các lệnh hỗ trợ:

```bash
./deploy.sh setup
./deploy.sh migrate
./deploy.sh seed
./deploy.sh deploy
./deploy.sh update
./deploy.sh status
./deploy.sh logs
```

Nếu để trống PostgreSQL host trong `setup`, script dùng `127.0.0.1` và mặc định `SSL Mode=Disable`. Nếu nhập IP/domain khác, mặc định là `SSL Mode=Require`.

Compose dùng Linux host networking. Vì vậy `APP_PORT` là port ASP.NET Core bind trực tiếp trên host; mặc định `8080`.

Tài liệu vận hành đầy đủ: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Start modes

Container có ba mode độc lập:

```text
migrations  chỉ áp dụng EF Core migrations rồi exit
seed        chỉ chạy bootstrap seed rồi exit
app         chỉ chạy ASP.NET Core + React, không tự migrate/seed
```

Docker image mặc định dùng `app`.

Các lệnh Docker Compose cấp thấp tương đương:

```bash
docker compose build german-app
docker compose run --rm --no-deps german-app migrations
docker compose run --rm --no-deps german-app seed
docker compose up -d --force-recreate german-app
```

Nếu migration thất bại thì không chạy app mới. `seed` không tự chạy migration; database phải có schema phù hợp trước.

Xem log:

```bash
./deploy.sh logs
```

Kiểm tra health mặc định:

```bash
curl http://127.0.0.1:8080/health
```

## PostgreSQL

Biến cấu hình ứng dụng:

```text
ConnectionStrings__German
```

Ví dụ PostgreSQL cùng máy host:

```text
ConnectionStrings__German=Host=127.0.0.1;Port=5432;Database=german;Username=german;Password=your-password;SSL Mode=Disable
```

Ví dụ PostgreSQL remote:

```text
ConnectionStrings__German=Host=db.example.com;Port=5432;Database=german;Username=german;Password=your-password;SSL Mode=Require
```

Server PostgreSQL cần cho phép kết nối từ máy deploy. Với kết nối remote nên bật SSL/TLS theo cấu hình của nhà cung cấp/database server.

## Tạo Admin đầu tiên

Bootstrap chỉ tạo Admin khi database chưa có tài khoản nào và `BootstrapAdmin__Enabled=true`. Không có mật khẩu production mặc định trong code.

`./deploy.sh setup` có thể tạo cấu hình bootstrap:

```text
BootstrapAdmin__Enabled=true
BootstrapAdmin__Username=admin
BootstrapAdmin__Password=<secret>
```

Sau khi migration thành công:

```bash
./deploy.sh seed
```

Sau khi tạo tài khoản đầu tiên, nên đặt lại:

```text
BootstrapAdmin__Enabled=false
BootstrapAdmin__Password=
```

Seed hiện tại là idempotent theo bootstrap rule: nếu database đã có tài khoản thì không tạo thêm bootstrap Admin.

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

Build frontend vào `German.Api/wwwroot`:

```bash
cd src/frontend
bun install --frozen-lockfile
bun run build:api
cd ../backend/German.Api
```

Chạy từng mode trực tiếp:

```bash
dotnet run -- migrations
dotnet run -- seed
dotnet run -- app
```

Không truyền mode cũng mặc định là `app`:

```bash
dotnet run
```

Có thể truyền ASP.NET host options sau mode, ví dụ:

```bash
dotnet run -- app --environment Development
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

Deployment helper:

```bash
bash -n deploy.sh
bash -n tests/deploy-script.test.sh
bash tests/deploy-script.test.sh
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

Có thể cập nhật database bằng EF tooling:

```bash
dotnet ef database update \
  --project src/backend/German.Infrastructure \
  --startup-project src/backend/German.Api
```

Trong deployment bằng Docker nên dùng `./deploy.sh migrate` để image đang deploy tự áp dụng migration của chính nó.

## Kiến trúc

```text
German.Domain          business entities + calculation engine
German.Application     use cases, authorization rules, validation, application queries/report abstractions
German.Infrastructure  EF Core/PostgreSQL, password hashing, bootstrap, OpenXML exporter
German.Api             Minimal API/auth/composition/start modes/static frontend host
src/frontend           React worker + manager/admin UI theo feature
```

Architecture contract bắt buộc nằm tại [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). CI có architecture tests để chặn dependency đi ngược tầng, endpoint truy cập persistence trực tiếp, OpenXML rò khỏi Infrastructure và deployment lifecycle/networking bị thay đổi ngoài ý muốn.

## Branch workflow

```text
main  <- stable/release
dev   <- integration
feat/*, fix/*, review/* -> dev -> main
```

Tính năng mới tách từ `dev`; không phát triển trực tiếp trên `main`. `dev` là nhánh integration để review trước khi đưa vào `main`.

Thiết kế chi tiết nằm trong `docs/superpowers/specs/` và implementation plan trong `docs/superpowers/plans/`.
