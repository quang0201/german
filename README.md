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

## Yêu cầu môi trường

- .NET SDK 10.x
- PostgreSQL
- Bun 1.3.14+

## Cấu hình PostgreSQL

Mặc định development:

```text
Host=localhost;Port=5432;Database=german;Username=postgres;Password=postgres
```

Nên ghi đè bằng biến môi trường:

```bash
export ConnectionStrings__German='Host=localhost;Port=5432;Database=german;Username=postgres;Password=your-password'
```

Khi API khởi động, EF Core tự áp dụng migration còn thiếu.

## Tạo Admin đầu tiên

Bootstrap chỉ chạy khi database chưa có tài khoản nào. Không có mật khẩu production mặc định trong code.

```bash
export BootstrapAdmin__Enabled=true
export BootstrapAdmin__Username=admin
export BootstrapAdmin__Password='change-this-password'
```

Sau lần khởi động đầu tiên, có thể tắt `BootstrapAdmin__Enabled`.

## Build frontend và chạy cùng API

Frontend gọi API cùng origin. Build frontend vào `German.Api/wwwroot`:

```bash
cd src/frontend
bun install
bun run build:api
cd ../backend/German.Api
dotnet run
```

Sau đó mở địa chỉ mà ASP.NET Core in ra trong terminal.

## Chạy test

Backend:

```bash
dotnet restore German.sln
dotnet build German.sln --no-restore
dotnet test German.sln --no-build
```

Frontend:

```bash
cd src/frontend
bun install
bun test
bun run build
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

Cập nhật database thủ công nếu không muốn chờ lúc API startup:

```bash
dotnet ef database update \
  --project src/backend/German.Infrastructure \
  --startup-project src/backend/German.Api
```

## Kiến trúc

```text
German.Domain          business entities + calculation engine
German.Application     use cases, authorization rules, validation
German.Infrastructure  EF Core/PostgreSQL, password hashing, bootstrap
German.Api             HTTP/auth/static frontend host
src/frontend           React worker + manager/admin UI
```

Thiết kế chi tiết nằm trong `docs/superpowers/specs/` và implementation plan trong `docs/superpowers/plans/`.
